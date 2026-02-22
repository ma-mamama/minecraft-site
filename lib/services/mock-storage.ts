/**
 * In-Memory Mock Storage for Development Mode
 * Provides a simple in-memory database replacement for local development
 */

import { User, Session, UserRow, SessionRow } from '../types/database';
import { randomUUID } from 'crypto';

// In-memory storage
const storage = {
  users: new Map<string, UserRow>(),
  sessions: new Map<string, SessionRow>(),
};

/**
 * Initialize mock storage with default test user
 */
export function initializeMockStorage() {
  // Clear existing data
  storage.users.clear();
  storage.sessions.clear();

  // Create default test user
  const testUser: UserRow = {
    id: 'test-user-id-001',
    line_sub: 'dev_test_user_12345',
    display_name: 'Development Test User',
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  };

  storage.users.set(testUser.line_sub, testUser);
}

/**
 * Get user by LINE_Sub
 */
export function getUserByLineSub(lineSub: string): UserRow | null {
  return storage.users.get(lineSub) || null;
}

/**
 * Get user by ID
 */
export function getUserById(userId: string): UserRow | null {
  for (const user of storage.users.values()) {
    if (user.id === userId) {
      return user;
    }
  }
  return null;
}

/**
 * Create a new user
 */
export function createUser(lineSub: string, displayName?: string): UserRow {
  const user: UserRow = {
    id: randomUUID(),
    line_sub: lineSub,
    display_name: displayName || null,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  };

  storage.users.set(lineSub, user);
  return user;
}

/**
 * Update user's last login time
 */
export function updateUserLastLogin(userId: string): void {
  const user = getUserById(userId);
  if (user) {
    user.last_login_at = new Date().toISOString();
  }
}

/**
 * Get session by ID
 */
export function getSessionById(sessionId: string): SessionRow | null {
  return storage.sessions.get(sessionId) || null;
}

/**
 * Create a new session
 */
export function createSession(userId: string, expiresAt: Date): SessionRow {
  const session: SessionRow = {
    id: randomUUID(),
    user_id: userId,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString(),
    last_accessed_at: new Date().toISOString(),
  };

  storage.sessions.set(session.id, session);
  return session;
}

/**
 * Update session's last accessed time
 */
export function updateSessionLastAccessed(sessionId: string): void {
  const session = storage.sessions.get(sessionId);
  if (session) {
    session.last_accessed_at = new Date().toISOString();
  }
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): void {
  storage.sessions.delete(sessionId);
}

/**
 * Delete expired sessions
 */
export function cleanupExpiredSessions(): void {
  const now = new Date();
  for (const [sessionId, session] of storage.sessions.entries()) {
    if (new Date(session.expires_at) < now) {
      storage.sessions.delete(sessionId);
    }
  }
}

/**
 * Get all users (for debugging)
 */
export function getAllUsers(): UserRow[] {
  return Array.from(storage.users.values());
}

/**
 * Get all sessions (for debugging)
 */
export function getAllSessions(): SessionRow[] {
  return Array.from(storage.sessions.values());
}

/**
 * Clear all data
 */
export function clearAllData(): void {
  storage.users.clear();
  storage.sessions.clear();
}

// Initialize on module load
if (process.env.DEV_MODE_SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
  initializeMockStorage();
}
