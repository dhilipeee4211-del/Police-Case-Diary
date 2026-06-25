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

-- Enable Row Level Security (RLS)
ALTER TABLE case_databases ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to select their own records
CREATE POLICY "Allow select for user" ON case_databases
  FOR SELECT USING (true);

-- Create policy to allow all users to insert their own records
CREATE POLICY "Allow insert for user" ON case_databases
  FOR INSERT WITH CHECK (true);

-- Create policy to allow all users to update their own records
CREATE POLICY "Allow update for user" ON case_databases
  FOR UPDATE USING (true);

-- Create policy to allow all users to delete their own records
CREATE POLICY "Allow delete for user" ON case_databases
  FOR DELETE USING (true);
`;
}
