/**
 * Tests for Invitation Code Generation API Route
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as auth from '@/lib/services/auth';
import * as invitation from '@/lib/services/invitation';
import { cookies } from 'next/headers';

// Mock dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/services/auth', () => ({
  validateSession: vi.fn(),
}));

vi.mock('@/lib/services/invitation', () => ({
  generateInvitationCode: vi.fn(),
}));

describe('POST /api/invitation/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when session cookie is missing', async () => {
    // Mock cookies to return no session
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/invitation/generate', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('should return 401 when session is invalid', async () => {
    // Mock cookies to return session
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'invalid-session-id' }),
    } as any);

    // Mock validateSession to return null
    vi.mocked(auth.validateSession).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/invitation/generate', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('INVALID_SESSION');
  });

  it('should generate invitation code when authenticated', async () => {
    // Mock cookies to return session
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'valid-session-id' }),
    } as any);

    // Mock validateSession to return user
    vi.mocked(auth.validateSession).mockResolvedValue({
      id: 'user-123',
      line_sub: 'line-sub-123',
      display_name: 'Test User',
      created_at: new Date(),
      last_login_at: new Date(),
    });

    // Mock generateInvitationCode
    const mockCode = {
      id: 'code-123',
      code: 'ABC123DEF456',
      created_at: new Date(),
      expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours from now
      used_at: null,
      used_by_user_id: null,
      is_used: false,
    };
    vi.mocked(invitation.generateInvitationCode).mockResolvedValue(mockCode);

    const request = new NextRequest('http://localhost:3000/api/invitation/generate', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.code).toBe('ABC123DEF456');
    expect(data.expiresAt).toBeDefined();
    expect(invitation.generateInvitationCode).toHaveBeenCalledOnce();
  });

  it('should return 500 when code generation fails', async () => {
    // Mock cookies to return session
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'valid-session-id' }),
    } as any);

    // Mock validateSession to return user
    vi.mocked(auth.validateSession).mockResolvedValue({
      id: 'user-123',
      line_sub: 'line-sub-123',
      display_name: 'Test User',
      created_at: new Date(),
      last_login_at: new Date(),
    });

    // Mock generateInvitationCode to throw error
    vi.mocked(invitation.generateInvitationCode).mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost:3000/api/invitation/generate', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('UNKNOWN_ERROR');
  });
});
