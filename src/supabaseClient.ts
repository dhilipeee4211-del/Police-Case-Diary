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

-- Enable Row Level Security (RLS) on both tables
ALTER TABLE case_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_access ENABLE ROW LEVEL SECURITY;

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
`;
}
