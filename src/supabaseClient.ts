import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// Lazy client creator to prevent crashes if variables are missing on startup
let supabaseInstance: any = null;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey || !isValidUrl(supabaseUrl)) {
    return null;
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl));
}

/**
 * Returns the SQL statement to run in the Supabase SQL Editor
 * to provision the required schema.
 */
export function getSupabaseSetupSQL(): string {
  return `-- Create the case_databases table
CREATE TABLE IF NOT EXISTS case_databases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  diaries JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Create the database_access table to store shared database permissions permanently
CREATE TABLE IF NOT EXISTS database_access (
  email TEXT NOT NULL,
  db_id TEXT NOT NULL,
  PRIMARY KEY (email, db_id)
);

-- Create the case_diary_duplicate_backup table
CREATE TABLE IF NOT EXISTS case_diary_duplicate_backup (
  id TEXT PRIMARY KEY,
  original_record_id TEXT NOT NULL,
  original_record JSONB NOT NULL,
  backup_timestamp BIGINT NOT NULL,
  deleted_by TEXT NOT NULL,
  delete_reason TEXT NOT NULL,
  cleanup_session_id TEXT NOT NULL,
  original_created_date TEXT,
  original_updated_date TEXT
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE case_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_diary_duplicate_backup ENABLE ROW LEVEL SECURITY;

-- Create policies for case_databases
CREATE POLICY "Allow select for user" ON case_databases FOR SELECT USING (true);
CREATE POLICY "Allow insert for user" ON case_databases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for user" ON case_databases FOR UPDATE USING (true);
CREATE POLICY "Allow delete for user" ON case_databases FOR DELETE USING (true);

-- Create policies for database_access
CREATE POLICY "Allow select for all" ON database_access FOR SELECT USING (true);
CREATE POLICY "Allow insert for all" ON database_access FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all" ON database_access FOR UPDATE USING (true);
CREATE POLICY "Allow delete for all" ON database_access FOR DELETE USING (true);

-- Create policies for case_diary_duplicate_backup
CREATE POLICY "Allow select for backup" ON case_diary_duplicate_backup FOR SELECT USING (true);
CREATE POLICY "Allow insert for backup" ON case_diary_duplicate_backup FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow delete for backup" ON case_diary_duplicate_backup FOR DELETE USING (true);

-- ── Extraction Monitoring Tables ─────────────────────────────────────────────

-- case_diary_extraction_sessions: one row per PDF extraction run
CREATE TABLE IF NOT EXISTS case_diary_extraction_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT,
  pdf_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  total_pages INTEGER DEFAULT 0,
  processed_pages INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  current_chunk INTEGER DEFAULT 0,
  concurrency INTEGER DEFAULT 1,
  chunk_size INTEGER DEFAULT 5,
  speed_sec_per_page REAL DEFAULT 0,
  avg_chunk_time_sec REAL DEFAULT 0,
  elapsed_seconds INTEGER DEFAULT 0,
  eta_seconds INTEGER DEFAULT 0,
  db_id TEXT,
  db_name TEXT,
  device TEXT,
  error TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- case_diary_extraction_chunks: one row per processed chunk
CREATE TABLE IF NOT EXISTS case_diary_extraction_chunks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  database_saved BOOLEAN DEFAULT FALSE,
  import_status TEXT DEFAULT 'pending',
  processing_time_ms INTEGER DEFAULT 0,
  api_key_label TEXT,
  retry_count INTEGER DEFAULT 0,
  updated_at BIGINT NOT NULL
);

-- case_diary_import_logs: import result summary per session
CREATE TABLE IF NOT EXISTS case_diary_import_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  database_id TEXT,
  imported_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  duplicate_skipped INTEGER DEFAULT 0,
  backup_created INTEGER DEFAULT 0,
  speed_records_per_sec REAL DEFAULT 0,
  created_at BIGINT NOT NULL
);

-- system_activity_logs: mirror of Logger entries for cross-device monitoring
CREATE TABLE IF NOT EXISTS system_activity_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'engine',
  session_id TEXT,
  timestamp BIGINT NOT NULL
);

-- Enable RLS on all new tables
ALTER TABLE case_diary_extraction_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_diary_extraction_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_diary_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for case_diary_extraction_sessions
CREATE POLICY "Allow all for sessions" ON case_diary_extraction_sessions FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for case_diary_extraction_chunks
CREATE POLICY "Allow all for chunks" ON case_diary_extraction_chunks FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for case_diary_import_logs
CREATE POLICY "Allow all for import_logs" ON case_diary_import_logs FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for system_activity_logs
CREATE POLICY "Allow all for activity_logs" ON system_activity_logs FOR ALL USING (true) WITH CHECK (true);
`;
}
