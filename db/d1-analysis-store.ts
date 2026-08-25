import type {
  AnalysisStore,
  ConversationMessage,
  EscalationEvent,
  Finding,
  Severity,
  StageRun
} from '../lib/analysis/types.ts';

export class D1AnalysisStore implements AnalysisStore {
  constructor(private readonly db:D1Database){}

  async createConversation(input:{
    id:string;
    source:string;
    externalReference?:string;
    participantContext:unknown;
    evidenceObjectKey:string;
    evidenceSha256:string;
    startedAt:string;
    messages:ConversationMessage[];
  }){
    const createdAt=new Date().toISOString();
    const statements=[
      this.db.prepare(
        `INSERT INTO conversations
          (id, source, external_reference, participant_context_json, evidence_object_key,
           evidence_sha256, started_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      ).bind(
        input.id,
        input.source,
        input.externalReference??null,
        JSON.stringify(input.participantContext),
        input.evidenceObjectKey,
        input.evidenceSha256,
        input.startedAt,
        createdAt
      ),
      ...input.messages.map(message=>this.db.prepare(
        `INSERT INTO messages
          (id, conversation_id, source_sequence, sender_id, sender_role, text, sent_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(
        message.id,
        input.id,
        message.sequence,
        message.senderId,
        message.senderRole,
        message.text,
        message.sentAt
      ))
    ];
    await this.db.batch(statements);
  }

  async recordStage(run:StageRun){
    await this.db.prepare(
      `INSERT INTO analysis_runs
        (id, conversation_id, profile_version, stage, model, input_hash, decision_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    ).bind(
      run.id,
      run.conversationId,
      run.profileVersion,
      run.stage,
      run.model??null,
      run.inputHash,
      JSON.stringify(run.decision),
      run.createdAt
    ).run();
  }

  async recordFindings(runId:string, findings:Finding[]){
    if(findings.length===0)return;
    const createdAt=new Date().toISOString();
    await this.db.batch(findings.map(finding=>this.db.prepare(
      `INSERT INTO findings
        (id, analysis_run_id, signal_code, label, severity, score,
         evidence_message_ids_json, explanation, source, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    ).bind(
      crypto.randomUUID(),
      runId,
      finding.signalCode,
      finding.label,
      finding.severity,
      finding.score,
      JSON.stringify(finding.evidenceMessageIds),
      finding.explanation,
      finding.source,
      createdAt
    )));
  }

  async recordEscalation(event:EscalationEvent){
    await this.db.prepare(
      `INSERT INTO escalation_events
        (id, conversation_id, from_stage, to_stage, reasons_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    ).bind(
      event.id,
      event.conversationId,
      event.fromStage,
      event.toStage,
      JSON.stringify(event.reasons),
      event.createdAt
    ).run();
  }

  async completeConversation(conversationId:string,riskScore:number,severity:Severity){
    await this.db.prepare(
      `UPDATE conversations
       SET current_risk_score = ?1, current_severity = ?2
       WHERE id = ?3`
    ).bind(riskScore,severity,conversationId).run();
  }
}
