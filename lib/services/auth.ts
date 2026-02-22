/**
 * Authentication Service
 * Handles LINE token verification, session management, and whitelist checking
 * Requirements: 2.3, 2.4, 2.5, 2.6, 7.1, 7.2
 */

import { supabaseServer } from '../supabase/server';
import { User, Session, UserRow, SessionRow, UserInsert, SessionInsert } from '../types/database';
import { randomUUID } from 'crypto';
import { logError, logInfo, logWarn } from '@/lib/utils/logger';

/**
 * LINE user information extracted from verified ID token
 */
export interface LineUser {
  sub: string;
  name?: string;
  picture?: string;
}

/**
 * Session cookie configuration
 */
export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
}

/**
 * Convert database row to User object
 */
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    line_sub: row.line_sub,
    display_name: row.display_name,
    created_at: new Date(row.created_at),
    last_login_at: row.last_login_at ? new Date(row.last_login_at) : null,
  };
}

/**
 * Convert database row to Session object
 */
function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    user_id: row.user_id,
    expires_at: new Date(row.expires_at),
    created_at: new Date(row.created_at),
    last_accessed_at: new Date(row.last_accessed_at),
  };
}

/**
 * Verify LINE ID token and extract user information
 * Requirement 2.3: Verify token signature and claims before trusting user information
 * Requirement 2.4: Extract LINE_Sub from verified token
 * 
 * @param idToken - The ID token received from LINE
 * @returns LineUser object with verified user information
 * @throws Error if token verification fails
 */
export async function verifyLineToken(idToken: string): Promise<LineUser> {
  if (!process.env.LINE_CHANNEL_ID) {
    throw new Error('LINE_CHANNEL_ID not configured');
  }

  try {
    // Parse the JWT token (format: header.payload.signature)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Decode the payload (base64url encoded)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    // Verify required claims
    if (!payload.sub) {
      throw new Error('Missing sub claim in token');
    }

    if (!payload.aud || payload.aud !== process.env.LINE_CHANNEL_ID) {
      throw new Error('Invalid audience claim');
    }

    if (!payload.iss || payload.iss !== 'https://access.line.me') {
      throw new Error('Invalid issuer claim');
    }

    if (!payload.exp || payload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }

    // In production, you should verify the signature using LINE's public keys (JWKS)
    // For now, we verify the structure and claims
    // TODO: Implement full signature verification with LINE's JWKS endpoint

    logInfo('LINE token verified successfully', { lineSub: payload.sub });

    return {
      sub: payload.sub,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    logError('LINE token verification failed', error);
    if (error instanceof Error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Check if a LINE_Sub is in the whitelist
 * Requirement 2.6: Check whitelist before granting access
 * Requirement 7.2: Verify LINE_Sub is whitelisted
 * 
 * @param lineSub - The LINE_Sub to check
 * @returns true if whitelisted, false otherwise
 */
export async function isWhitelisted(lineSub: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseServer
      .from('users')
      .select('id')
      .eq('line_sub', lineSub)
      .single();

    if (error) {
      // User not found is not an error, just not whitelisted
      if (error.code === 'PGRST116') {
        logInfo('User not in whitelist', { lineSub });
        return false;
      }
      throw error;
    }

    logInfo('User whitelist check passed', { lineSub });
    return !!data;
  } catch (error) {
    logError('Error checking whitelist', error, { lineSub });
    return false;
  }
}

/**
 * Create a new session for a user
 * Requirement 2.5: Create session with secure cookie attributes
 * Requirement 7.1: Create valid session for authenticated users
 * 
 * @param lineSub - The LINE_Sub of the user
 * @returns Session object
 * @throws Error if user not found or session creation fails
 */
export async function createSession(lineSub: string): Promise<Session> {
  try {
    // Get user by LINE_Sub
    const { data: userData, error: userError } = await supabaseServer
      .from('users')
      .select('*')
      .eq('line_sub', lineSub)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    // Update last login time
    await supabaseServer
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userData.id);

    // Calculate session expiration
    const expiryDays = parseInt(process.env.SESSION_EXPIRY_DAYS || '7', 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create session
    const sessionInsert: SessionInsert = {
      user_id: userData.id,
      expires_at: expiresAt.toISOString(),
    };

    const { data: sessionData, error: sessionError } = await supabaseServer
      .from('sessions')
      .insert(sessionInsert)
      .select()
      .single();

    if (sessionError || !sessionData) {
      throw new Error('Failed to create session');
    }

    return rowToSession(sessionData);
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

/**
 * Validate a session and return the associated user
 * Requirement 7.1: Verify session exists and not expired
 * 
 * @param sessionId - The session ID to validate
 * @returns User object if session is valid, null otherwise
 */
export async function validateSession(sessionId: string): Promise<User | null> {
  try {
    // Get session with user data
    const { data: sessionData, error: sessionError } = await supabaseServer
      .from('sessions')
      .select('*, users(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      return null;
    }

    // Check if session is expired
    const expiresAt = new Date(sessionData.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired session
      await supabaseServer
        .from('sessions')
        .delete()
        .eq('id', sessionId);
      return null;
    }

    // Update last accessed time
    await supabaseServer
      .from('sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Return user data
    const user = sessionData.users as unknown as UserRow;
    return rowToUser(user);
  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
}

/**
 * Invalidate a session (logout)
 * 
 * @param sessionId - The session ID to invalidate
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  try {
    await supabaseServer
      .from('sessions')
      .delete()
      .eq('id', sessionId);
  } catch (error) {
    console.error('Error invalidating session:', error);
    throw error;
  }
}

/**
 * Get secure cookie options for session cookies
 * Requirement 2.5: Session cookie with HttpOnly, Secure, and SameSite=Lax
 * Requirement 7.4: Secure cookie attributes
 * 
 * @returns SessionCookieOptions object
 */
export function getSessionCookieOptions(): SessionCookieOptions {
  const expiryDays = parseInt(process.env.SESSION_EXPIRY_DAYS || '7', 10);
  const maxAge = expiryDays * 24 * 60 * 60; // Convert days to seconds

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  };
}

/**
 * Create a new user and add to whitelist
 * Requirement 1.4: Add LINE_Sub to whitelist when user account is created
 * 
 * @param lineSub - The LINE_Sub of the new user
 * @param displayName - Optional display name
 * @returns User object
 */
export async function createUser(
  lineSub: string,
  displayName?: string
): Promise<User> {
  try {
    const userInsert: UserInsert = {
      line_sub: lineSub,
      display_name: displayName || null,
    };

    const { data, error } = await supabaseServer
      .from('users')
      .insert(userInsert)
      .select()
      .single();

    if (error || !data) {
      throw new Error('Failed to create user');
    }

    return rowToUser(data);
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}
