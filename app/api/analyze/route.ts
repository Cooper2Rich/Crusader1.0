import {env} from 'cloudflare:workers';
import profileDefinition from '../../../data/profiles/grooming-risk-profile.v1.json';
import {D1AnalysisStore} from '../../../db/d1-analysis-store.ts';
import {initializeDatabase} from '../../../db/schema.ts';
import {createConversationAnalyzer} from '../../../lib/analysis/analyze-conversation.ts';
import {DisabledModelAnalyst,OpenAIResponsesAnalyst} from '../../../lib/analysis/openai-analyst.ts';
import type {ConversationMessage,ParticipantRole,RiskProfile} from '../../../lib/analysis/types.ts';

type CrusaderEnv={
  DB:D1Database;
  EVIDENCE:R2Bucket;
  OPENAI_API_KEY?:string;
  ENABLE_LIVE_ANALYSIS?:string;
};

type IncomingMessage={
  id?:unknown;
  senderId?:unknown;
  senderRole?:unknown;
  text?:unknown;
  sentAt?:unknown;
};

export async function POST(request:Request){
  try{
    const contentLength=Number(request.headers.get('content-length')??0);
    if(contentLength>250_000)return Response.json({error:'request_too_large'},{status:413});
    const body=await request.json() as Record<string,unknown>;
    const incomingMessages=validateMessages(body.messages);
    const conversationId=crypto.randomUUID();
    const messages=incomingMessages.map(message=>({...message,id:`${conversationId}:${message.id}`}));
    const runtime=env as unknown as CrusaderEnv;
    const profile=profileDefinition as RiskProfile;
    await initializeDatabase(runtime.DB,profile);

    const source=typeof body.source==='string'?body.source.slice(0,80):'authorized_demo_input';
    const evidencePayload=JSON.stringify({
      conversationId,
      source,
      profileVersion:profile.version,
      capturedAt:new Date().toISOString(),
      messages
    });
    const evidenceSha256=await sha256(evidencePayload);
    const evidenceObjectKey=`conversations/${conversationId}/source.json`;
    await runtime.EVIDENCE.put(evidenceObjectKey,evidencePayload,{
      httpMetadata:{contentType:'application/json; charset=utf-8'},
      customMetadata:{sha256:evidenceSha256,profileVersion:profile.version}
    });

    const store=new D1AnalysisStore(runtime.DB);
    await store.createConversation({
      id:conversationId,
      source,
      externalReference:typeof body.externalReference==='string'?body.externalReference.slice(0,160):undefined,
      participantContext:{syntheticDemo:body.syntheticDemo===true},
      evidenceObjectKey,
      evidenceSha256,
      startedAt:messages[0]?.sentAt??new Date().toISOString(),
      messages
    });

    const liveEnabled=runtime.ENABLE_LIVE_ANALYSIS==='true'&&Boolean(runtime.OPENAI_API_KEY);
    const modelAnalyst=liveEnabled
      ?new OpenAIResponsesAnalyst(runtime.OPENAI_API_KEY!)
      :new DisabledModelAnalyst();
    const analyzer=createConversationAnalyzer({
      store,
      smallAnalyst:modelAnalyst,
      largeAnalyst:modelAnalyst
    });
    const result=await analyzer.analyze({
      conversationId,
      messages,
      profile,
      inputHash:await sha256(JSON.stringify({profileVersion:profile.version,messages}))
    });
    await store.completeConversation(conversationId,result.riskScore,result.severity);
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  }catch(error){
    console.error('Analysis request failed',error instanceof Error?`${error.name}: ${error.message}`:'UnknownError');
    return Response.json({error:'analysis_unavailable'},{status:500});
  }
}

function validateMessages(value:unknown):ConversationMessage[]{
  if(!Array.isArray(value)||value.length===0||value.length>100){
    throw new Error('Messages must contain between 1 and 100 records.');
  }
  return value.map((item,index)=>{
    const message=item as IncomingMessage;
    if(typeof message.text!=='string'||message.text.length===0||message.text.length>4_000){
      throw new Error('Each message must contain 1 to 4,000 characters.');
    }
    const role=normalizeRole(message.senderRole);
    return {
      id:typeof message.id==='string'?message.id.slice(0,100):`msg-${index+1}`,
      sequence:index+1,
      senderId:typeof message.senderId==='string'?message.senderId.slice(0,100):'unknown',
      senderRole:role,
      text:message.text,
      sentAt:typeof message.sentAt==='string'?message.sentAt:new Date(Date.now()+index*1_000).toISOString()
    };
  });
}

function normalizeRole(value:unknown):ParticipantRole{
  if(value==='adult'||value==='child_persona'||value==='unknown')return value;
  return 'unknown';
}

async function sha256(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
