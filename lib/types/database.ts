/**
 * Database type definitions for Supabase tables
 * These types match the schema defined in supabase/migrations/20240222000000_initial_schema.sql
 */

export interface User {
  id: string;
  line_sub: string;
  display_name: string | null;
  created_at: Date;
  last_login_at: Date | null;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: Date;
  created_at: Date;
  last_accessed_at: Date;
}

export interface InvitationCode {
  id: string;
  code: string;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
  used_by_user_id: string | null;
  is_used: boolean;
}

export interface OperationLock {
  id: string;
  lock_id: string;
  operation_type: string;
  created_at: Date;
  expires_at: Date;
}

/**
 * Database row types (as returned from Supabase queries)
 */
export interface UserRow {
  id: string;
  line_sub: string;
  display_name: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
  last_accessed_at: string;
}

export interface InvitationCodeRow {
  id: string;
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
  is_used: boolean;
}

export interface OperationLockRow {
  id: string;
  lock_id: string;
  operation_type: string;
  created_at: string;
  expires_at: string;
}

/**
 * Insert types (for creating new records)
 */
export interface UserInsert {
  line_sub: string;
  display_name?: string | null;
}

export interface SessionInsert {
  user_id: string;
  expires_at: string;
}

export interface InvitationCodeInsert {
  code: string;
  expires_at: string;
}

export interface OperationLockInsert {
  lock_id: string;
  operation_type: string;
  expires_at: string;
}

/**
 * EC2 instance state types
 */
export type EC2State = 'pending' | 'running' | 'stopping' | 'stopped' | 'terminated';

export interface EC2InstanceState {
  state: EC2State;
  timestamp: Date;
}
