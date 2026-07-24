import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as { env?: Record<string, string> }).env ?? {};
export const SUPABASE_URL = metaEnv.VITE_SUPABASE_URL || 'https://yzlyeuikvbwhgjrjntvi.supabase.co';
export const SUPABASE_ANON_KEY = metaEnv.VITE_SUPABASE_ANON_KEY || 'sb_publishable_he_GbjYhcIO6KjiUQDdaoA_xHnDKG1z';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

