import {analyzeRules,highestSeverity,severityForScore} from './rules.ts';
import type {
  AnalysisResult,
  AnalysisStage,
  AnalysisStore,
  ConversationMessage,
  Finding,
  ModelAnalyst,
  ModelDecision,
  RiskProfile,
  RuleAnalysis
} from './types.ts';

export interface ConversationAnalyzer {
  analyze(input:{
    conversationId:string;
    messages:ConversationMessage[];
    profile:RiskProfile;
    inputHash:string;
  }):Promise<AnalysisResult>;
}

type Dependencies={
  store:AnalysisStore;
  smallAnalyst:ModelAnalyst;
  largeAnalyst:ModelAnalyst;
  random?:()=>number;
  now?:()=>string;
  id?:()=>string;
};

export function createConversationAnalyzer(dependencies:Dependencies):ConversationAnalyzer{
  const random=dependencies.random??Math.random;
  const now=dependencies.now??(()=>new Date().toISOString());
  const id=dependencies.id??(()=>crypto.randomUUID());

  return {async analyze(input){
    const {conversationId,messages,profile,inputHash}=input;
    const stagesUsed:AnalysisStage[]=['rules'];
    const escalationReasons:string[]=[];
    let modelFailure=false;
    let successfulModel=false;
    const rules=analyzeRules(messages,profile);
    const rulesRunId=id();
    await dependencies.store.recordStage({
      id:rulesRunId,conversationId,profileVersion:profile.version,stage:'rules',
      inputHash,decision:rules,createdAt:now()
    });
    await dependencies.store.recordFindings(rulesRunId,rules.findings);

    if(rules.riskScore<profile.thresholds.skipModelsBelow){
      return finalize({rules,conversationId,profile,inputHash,stagesUsed,escalationReasons,
        modelFailure,successfulModel,store:dependencies.store,id,now});
    }

    await escalate('rules','small_model',['rule_threshold_met']);
    let small:ModelDecision|undefined;
    stagesUsed.push('small_model');
    try{
      small=await dependencies.smallAnalyst.analyze({
        model:profile.models.small,messages,profile,ruleAnalysis:rules
      });
      successfulModel=true;
      await recordModelStage('small_model',profile.models.small,small);
    }catch(error){
      modelFailure=true;
      escalationReasons.push('small_model_failed');
      await recordModelStage('small_model',profile.models.small,{status:'failed',error:errorName(error)});
    }

    const largeReasons=small?largeEscalationReasons(small,rules,profile,random):['small_model_failed'];
    if(largeReasons.length===0){
      return finalize({rules,modelDecision:small,conversationId,profile,inputHash,stagesUsed,
        modelSource:'small_model',escalationReasons,modelFailure,successfulModel,
        store:dependencies.store,id,now});
    }

    escalationReasons.push(...largeReasons);
    await escalate('small_model','large_model',largeReasons);
    stagesUsed.push('large_model');
    let large:ModelDecision|undefined;
    try{
      large=await dependencies.largeAnalyst.analyze({
        model:profile.models.large,messages,profile,ruleAnalysis:rules,priorDecision:small
      });
      successfulModel=true;
      await recordModelStage('large_model',profile.models.large,large);
    }catch(error){
      modelFailure=true;
      escalationReasons.push('large_model_failed');
      await recordModelStage('large_model',profile.models.large,{status:'failed',error:errorName(error)});
    }

    return finalize({rules,modelDecision:large??small,modelSource:large?'large_model':small?'small_model':undefined,
      conversationId,profile,inputHash,stagesUsed,
      escalationReasons,modelFailure,successfulModel,store:dependencies.store,id,now});

    async function recordModelStage(stage:'small_model'|'large_model',model:string,decision:unknown){
      await dependencies.store.recordStage({
        id:id(),conversationId,profileVersion:profile.version,stage,model,inputHash,
        decision,createdAt:now()
      });
    }

    async function escalate(fromStage:AnalysisStage,toStage:AnalysisStage,reasons:string[]){
      await dependencies.store.recordEscalation({
        id:id(),conversationId,fromStage,toStage,reasons,createdAt:now()
      });
    }
  }};
}

function largeEscalationReasons(
  decision:ModelDecision,
  rules:RuleAnalysis,
  profile:RiskProfile,
  random:()=>number
){
  const reasons:string[]=[];
  const ruleCodes=new Set(rules.findings.map(finding=>finding.signalCode));
  const modelCodes=new Set(decision.signalCodes);
  if(decision.decision==='uncertain'||decision.decision==='possible')reasons.push('small_model_uncertain');
  if(decision.outOfDistribution)reasons.push('out_of_distribution');
  if(decision.decision!=='no_signal'&&decision.evidenceMessageIds.length===0)reasons.push('missing_evidence');
  if([...ruleCodes].some(code=>!modelCodes.has(code))&&decision.decision==='no_signal')reasons.push('rules_model_disagreement');
  const criticalCodes=new Set(profile.signals.filter(signal=>signal.severity==='critical').map(signal=>signal.code));
  if([...new Set([...ruleCodes,...modelCodes])].some(code=>criticalCodes.has(code)))reasons.push('critical_signal');
  if(random()<profile.thresholds.randomAuditRate)reasons.push('quality_audit_sample');
  return [...new Set(reasons)];
}

async function finalize(input:{
  rules:RuleAnalysis;
  modelDecision?:ModelDecision;
  modelSource?:'small_model'|'large_model';
  conversationId:string;
  profile:RiskProfile;
  inputHash:string;
  stagesUsed:AnalysisStage[];
  escalationReasons:string[];
  modelFailure:boolean;
  successfulModel:boolean;
  store:AnalysisStore;
  id:()=>string;
  now:()=>string;
}){
  const modelFindings=input.modelDecision&&input.modelSource
    ?findingsFromDecision(input.modelDecision,input.profile,input.modelSource):[];
  const findings=mergeFindings(input.rules.findings,modelFindings);
  const riskScore=Math.max(input.rules.riskScore,input.modelDecision?.riskScore??0);
  const severity=highestSeverity(
    input.rules.severity,
    input.modelDecision?.severity??'none',
    severityForScore(riskScore,input.profile)
  );
  const requiresHumanReview=
    riskScore>=input.profile.thresholds.humanReviewAt||
    severity==='critical'||
    input.modelDecision?.requiresHumanReview===true||
    (input.modelFailure&&(riskScore>=input.profile.thresholds.highAt||severity==='high'));
  const modelMode=input.modelFailure?'degraded':input.successfulModel?'live':'rules_only';
  const result:AnalysisResult={
    conversationId:input.conversationId,
    profileVersion:input.profile.version,
    riskScore,severity,findings,
    stagesUsed:[...input.stagesUsed,'final'],
    requiresHumanReview,
    escalationReasons:[...new Set(input.escalationReasons)],
    modelMode
  };
  const finalRunId=input.id();
  await input.store.recordStage({
    id:finalRunId,conversationId:input.conversationId,profileVersion:input.profile.version,
    stage:'final',inputHash:input.inputHash,decision:result,createdAt:input.now()
  });
  await input.store.recordFindings(finalRunId,findings);
  return result;
}

function findingsFromDecision(
  decision:ModelDecision,
  profile:RiskProfile,
  source:'small_model'|'large_model'
):Finding[]{
  return decision.signalCodes.map(code=>{
    const definition=profile.signals.find(signal=>signal.code===code)!;
    return {
      signalCode:code,
      label:definition.label,
      severity:highestSeverity(definition.severity,decision.severity),
      score:Math.max(definition.weight,Math.round(decision.riskScore/Math.max(1,decision.signalCodes.length))),
      evidenceMessageIds:decision.evidenceMessageIds,
      explanation:decision.explanation,
      source
    };
  });
}

function mergeFindings(ruleFindings:Finding[],modelFindings:Finding[]){
  const merged=new Map(ruleFindings.map(finding=>[finding.signalCode,finding]));
  for(const finding of modelFindings){
    const existing=merged.get(finding.signalCode);
    merged.set(finding.signalCode,existing?{
      ...finding,
      evidenceMessageIds:[...new Set([...existing.evidenceMessageIds,...finding.evidenceMessageIds])]
    }:finding);
  }
  return [...merged.values()];
}

function errorName(error:unknown){return error instanceof Error?error.name:'UnknownError'}
