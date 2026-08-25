import type {ConversationMessage,Finding,RiskProfile,RuleAnalysis,Severity} from './types.ts';

const severityOrder:Record<Severity,number>={none:0,elevated:1,high:2,critical:3};

export function severityForScore(score:number,profile:RiskProfile):Severity{
  if(score>=profile.thresholds.criticalAt)return 'critical';
  if(score>=profile.thresholds.highAt)return 'high';
  if(score>=profile.thresholds.elevatedAt)return 'elevated';
  return 'none';
}

export function highestSeverity(...values:Severity[]):Severity{
  return values.reduce((highest,value)=>severityOrder[value]>severityOrder[highest]?value:highest,'none');
}

function normalizeText(value:string){
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

export function analyzeRules(messages:ConversationMessage[],profile:RiskProfile):RuleAnalysis{
  const candidateMessages=messages.filter(message=>message.senderRole!=='child_persona');
  const findings:Finding[]=[];

  for(const signal of profile.signals){
    const evidence=candidateMessages.filter(message=>{
      const normalized=normalizeText(message.text);
      const excluded=(signal.exclusions??[]).some(phrase=>normalized.includes(normalizeText(phrase)));
      return !excluded&&signal.phrases.some(phrase=>normalized.includes(normalizeText(phrase)));
    });
    if(evidence.length===0)continue;
    findings.push({
      signalCode:signal.code,
      label:signal.label,
      severity:signal.severity,
      score:signal.weight,
      evidenceMessageIds:evidence.map(message=>message.id),
      explanation:`Matched the versioned ${signal.label.toLowerCase()} profile definition.`,
      source:'rules'
    });
  }

  const distinctEvidence=new Set(findings.flatMap(finding=>finding.evidenceMessageIds)).size;
  const progressionBoost=findings.length>=3&&distinctEvidence>=2?5:0;
  const riskScore=Math.min(100,findings.reduce((sum,finding)=>sum+finding.score,0)+progressionBoost);
  const signalSeverity=findings.reduce((current,finding)=>highestSeverity(current,finding.severity),'none' as Severity);
  return {riskScore,severity:highestSeverity(severityForScore(riskScore,profile),signalSeverity),findings};
}
