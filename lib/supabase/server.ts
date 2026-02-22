/**
 * Supabase client for server-side operations
 * Uses service role key for full database access
 * NEVER expose this client to client-side code
 */

import { createClient } from '@supabase/supabase-js';

// 開発モードの場合はSupabase設定をスキップ
const isDevMode = process.env.DEV_MODE_SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production';

if (!isDevMode) {
  if (!process.env.SUPABASE_URL) {
    throw new Error('Missing environment variable: SUPABASE_URL');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }
}

/**
 * Server-side Supabase client with service role privileges
 * Use this client in API routes and server components only
 * 
 * Note: In development mode (DEV_MODE_SKIP_AUTH=true), this client is created
 * with dummy credentials and should not be used. Use mock-storage instead.
 */
export const supabaseServer = createClient(
  process.env.SUPABASE_URL || 'https://dummy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
