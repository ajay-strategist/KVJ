import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as { env?: Record<string, string> }).env ?? {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://mock-project.supabase.co';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

