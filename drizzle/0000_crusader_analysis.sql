CREATE TABLE IF NOT EXISTS profile_versions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  definition_json TEXT NOT NULL CHECK (json_valid(definition_json)),
  created_at TEXT NOT NULL,
  UNIQUE(profile_id, version)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_reference TEXT,
  participant_context_json TEXT NOT NULL CHECK (json_valid(participant_context_json)),
  evidence_object_key TEXT NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  current_risk_score INTEGER NOT NULL DEFAULT 0,
  current_severity TEXT NOT NULL DEFAULT 'none',
  started_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  source_sequence INTEGER NOT NULL,
  sender_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('adult', 'child_persona', 'unknown')),
  text TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  UNIQUE(conversation_id, source_sequence)
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  profile_version TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('rules', 'small_model', 'large_model', 'final')),
  model TEXT,
  input_hash TEXT NOT NULL,
  decision_json TEXT NOT NULL CHECK (json_valid(decision_json)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  signal_code TEXT NOT NULL,
  label TEXT NOT NULL,
  severity TEXT NOT NULL,
  score INTEGER NOT NULL,
  evidence_message_ids_json TEXT NOT NULL CHECK (json_valid(evidence_message_ids_json)),
  explanation TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_labels (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  disposition TEXT NOT NULL,
  corrected_findings_json TEXT NOT NULL CHECK (json_valid(corrected_findings_json)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS escalation_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  reasons_json TEXT NOT NULL CHECK (json_valid(reasons_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sequence
ON messages(conversation_id, source_sequence);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_conversation_created
ON analysis_runs(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_input_profile
ON analysis_runs(input_hash, profile_version);

CREATE INDEX IF NOT EXISTS idx_findings_run
ON findings(analysis_run_id);

CREATE INDEX IF NOT EXISTS idx_escalations_conversation
ON escalation_events(conversation_id, created_at);

PRAGMA optimize;
