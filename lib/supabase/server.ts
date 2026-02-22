/**
 * Supabase client for server-side operations
 * Uses service role key for full database access
 * NEVER expose this client to client-side code
 */

import { createClient } from '@supabase/supabase-js';

// 開発モードの場合はSupabase設定をスキップ
const isDevMode = process.env.DEV_MODE_SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production';

// ビルド時またはランタイムで環境変数をチェック
// ビルド時はダミー値を許可し、ランタイムで実際の値が必要
if (!isDevMode && process.env.NODE_ENV === 'production') {
  // 本番環境のランタイムでのみ厳密にチェック
  // ビルド時は環境変数がなくてもエラーにしない
  if (typeof window === 'undefined' && process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('dummy')) {
    // 実際のSupabase URLが設定されている場合のみチェック
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('Warning: SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is missing');
    }
  }
}

/**
 * Server-side Supabase client with service role privileges
 * Use this client in API routes and server components only
 * 
 * Note: In development mode (DEV_MODE_SKIP_AUTH=true) or build time, this client is created
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
