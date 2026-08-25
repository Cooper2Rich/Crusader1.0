export type ParticipantRole = 'adult' | 'child_persona' | 'unknown';
export type Severity = 'none' | 'elevated' | 'high' | 'critical';
export type Decision = 'no_signal' | 'possible' | 'likely' | 'uncertain';
export type AnalysisStage = 'rules' | 'small_model' | 'large_model' | 'final';

export type ConversationMessage = {
  id: string;
  sequence: number;
  senderId: string;
  senderRole: ParticipantRole;
  text: string;
  sentAt: string;
};

export type RiskSignalDefinition = {
  code: string;
  label: string;
  description: string;
  scope: 'message' | 'conversation_window';
  weight: number;
  severity: Exclude<Severity, 'none'>;
  phrases: string[];
  exclusions?: string[];
};

export type RiskProfile = {
  id: string;
  version: string;
  promptVersion: string;
  name: string;
  status: 'draft' | 'active' | 'retired';
  models: {small: string; large: string};
  thresholds: {
    skipModelsBelow: number;
    elevatedAt: number;
    highAt: number;
    criticalAt: number;
    humanReviewAt: number;
    randomAuditRate: number;
  };
  signals: RiskSignalDefinition[];
};

export type Finding = {
  signalCode: string;
  label: string;
  severity: Severity;
  score: number;
  evidenceMessageIds: string[];
  explanation: string;
  source: 'rules' | 'small_model' | 'large_model';
};

export type RuleAnalysis = {
  riskScore: number;
  severity: Severity;
  findings: Finding[];
};

export type ModelDecision = {
  decision: Decision;
  severity: Severity;
  riskScore: number;
  signalCodes: string[];
  evidenceMessageIds: string[];
  explanation: string;
  uncertaintyReasons: string[];
  requiresHumanReview: boolean;
  outOfDistribution: boolean;
};

export type AnalysisResult = {
  conversationId: string;
  profileVersion: string;
  riskScore: number;
  severity: Severity;
  findings: Finding[];
  stagesUsed: AnalysisStage[];
  requiresHumanReview: boolean;
  escalationReasons: string[];
  modelMode: 'live' | 'rules_only' | 'degraded';
};

export type StageRun = {
  id: string;
  conversationId: string;
  profileVersion: string;
  stage: AnalysisStage;
  model?: string;
  inputHash: string;
  decision: unknown;
  createdAt: string;
};

export type EscalationEvent = {
  id: string;
  conversationId: string;
  fromStage: AnalysisStage;
  toStage: AnalysisStage;
  reasons: string[];
  createdAt: string;
};

export interface AnalysisStore {
  recordStage(run: StageRun): Promise<void>;
  recordFindings(runId: string, findings: Finding[]): Promise<void>;
  recordEscalation(event: EscalationEvent): Promise<void>;
}

export interface ModelAnalyst {
  analyze(input: {
    model: string;
    messages: ConversationMessage[];
    profile: RiskProfile;
    ruleAnalysis: RuleAnalysis;
    priorDecision?: ModelDecision;
  }): Promise<ModelDecision>;
}
