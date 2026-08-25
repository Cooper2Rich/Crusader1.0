import assert from 'node:assert/strict';
import test from 'node:test';
import {createConversationAnalyzer} from '../lib/analysis/analyze-conversation.ts';
import {MemoryAnalysisStore} from '../lib/analysis/memory-store.ts';
import type {
  ConversationMessage,
  ModelAnalyst,
  ModelDecision,
  RiskProfile
} from '../lib/analysis/types.ts';

const profile:RiskProfile={
  id:'test-profile',version:'1.0.0',promptVersion:'1.0.0',name:'Test profile',status:'active',
  models:{small:'small',large:'large'},
  thresholds:{skipModelsBelow:12,elevatedAt:20,highAt:55,criticalAt:80,humanReviewAt:80,randomAuditRate:0},
  signals:[
    {code:'trust',label:'Trust',description:'Trust language',scope:'message',weight:20,severity:'elevated',phrases:['trust me']},
    {code:'secrecy',label:'Secrecy',description:'Secrecy language',scope:'conversation_window',weight:80,severity:'critical',phrases:['keep this secret']}
  ]
};

class QueueAnalyst implements ModelAnalyst {
  calls:string[]=[];
  private readonly decisions:Array<ModelDecision|Error>;
  constructor(decisions:Array<ModelDecision|Error>){this.decisions=decisions}
  async analyze(input:Parameters<ModelAnalyst['analyze']>[0]){
    this.calls.push(input.model);
    const next=this.decisions.shift();
    if(next instanceof Error)throw next;
    if(!next)throw new Error('No queued model decision.');
    return next;
  }
}

function message(text:string):ConversationMessage{
  return {id:'m1',sequence:1,senderId:'adult',senderRole:'adult',text,sentAt:'2026-08-25T00:00:00Z'};
}

function decision(overrides:Partial<ModelDecision>={}):ModelDecision{
  return {
    decision:'likely',severity:'elevated',riskScore:25,signalCodes:['trust'],
    evidenceMessageIds:['m1'],explanation:'Evidence-backed test decision.',uncertaintyReasons:[],
    requiresHumanReview:false,outOfDistribution:false,...overrides
  };
}

function setup(smallDecisions:Array<ModelDecision|Error>,largeDecisions:Array<ModelDecision|Error>){
  const store=new MemoryAnalysisStore();
  const small=new QueueAnalyst(smallDecisions);
  const large=new QueueAnalyst(largeDecisions);
  let sequence=0;
  const analyzer=createConversationAnalyzer({
    store,smallAnalyst:small,largeAnalyst:large,random:()=>1,
    now:()=>`2026-08-25T00:00:0${sequence}Z`,id:()=>`id-${++sequence}`
  });
  return {store,small,large,analyzer};
}

test('benign text stops after deterministic rules',async()=>{
  const {analyzer,small,large}=setup([],[]);
  const result=await analyzer.analyze({conversationId:'c1',messages:[message('hello')],profile,inputHash:'hash'});
  assert.deepEqual(result.stagesUsed,['rules','final']);
  assert.equal(result.riskScore,0);
  assert.equal(result.modelMode,'rules_only');
  assert.equal(small.calls.length,0);
  assert.equal(large.calls.length,0);
});

test('a supported small-model decision avoids the larger model',async()=>{
  const {analyzer,small,large}=setup([decision()],[]);
  const result=await analyzer.analyze({conversationId:'c2',messages:[message('you can trust me')],profile,inputHash:'hash'});
  assert.deepEqual(result.stagesUsed,['rules','small_model','final']);
  assert.equal(result.modelMode,'live');
  assert.deepEqual(small.calls,['small']);
  assert.equal(large.calls.length,0);
});

test('small-model uncertainty escalates to the larger model',async()=>{
  const uncertain=decision({decision:'uncertain',uncertaintyReasons:['ambiguous context']});
  const adjudicated=decision({decision:'likely',riskScore:42});
  const {analyzer,large,store}=setup([uncertain],[adjudicated]);
  const result=await analyzer.analyze({conversationId:'c3',messages:[message('you can trust me')],profile,inputHash:'hash'});
  assert.deepEqual(result.stagesUsed,['rules','small_model','large_model','final']);
  assert.deepEqual(large.calls,['large']);
  assert.ok(store.escalations.some(event=>event.reasons.includes('small_model_uncertain')));
});

test('small-model failure fails over to the larger model',async()=>{
  const {analyzer,large}=setup([new Error('temporary failure')],[decision({riskScore:38})]);
  const result=await analyzer.analyze({conversationId:'c4',messages:[message('you can trust me')],profile,inputHash:'hash'});
  assert.deepEqual(large.calls,['large']);
  assert.equal(result.modelMode,'degraded');
  assert.ok(result.escalationReasons.includes('small_model_failed'));
});

test('critical signals always reach the larger model and require a human',async()=>{
  const critical=decision({
    severity:'critical',riskScore:92,signalCodes:['secrecy'],requiresHumanReview:true
  });
  const {analyzer,large}=setup([critical],[critical]);
  const result=await analyzer.analyze({conversationId:'c5',messages:[message('keep this secret')],profile,inputHash:'hash'});
  assert.deepEqual(large.calls,['large']);
  assert.equal(result.severity,'critical');
  assert.equal(result.requiresHumanReview,true);
  assert.ok(result.escalationReasons.includes('critical_signal'));
});

test('model outages fail closed for a high-severity rule finding',async()=>{
  const highProfile:RiskProfile={
    ...profile,
    signals:[{...profile.signals[0],severity:'high'}]
  };
  const {analyzer}=setup([new Error('offline')],[new Error('offline')]);
  const result=await analyzer.analyze({
    conversationId:'c6',messages:[message('you can trust me')],profile:highProfile,inputHash:'hash'
  });
  assert.equal(result.modelMode,'degraded');
  assert.equal(result.requiresHumanReview,true);
});
