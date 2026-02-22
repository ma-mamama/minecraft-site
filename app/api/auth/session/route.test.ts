/**
 * Tests for Session Validation API Route
 */

import { describe, test, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/services/auth', () => ({
  validateSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { GET } from './route';
import { NextRequest } from 'next/server';
import * as authService from '@/lib/services/auth';
import { cookies } from 'next/headers';

describe('GET /api/auth/session', () => {
  test('有効なセッションでユーザー情報が返される', async () => {
    const mockUser = {
      id: 'user-123',
      line_sub: 'test-line-sub',
      display_name: 'Test User',
      created_at: new Date('2024-01-01'),
      last_login_at: new Date('2024-01-15'),
    };

    const mockCookies = {
      get: vi.fn().mockReturnValue({ value: 'session-123' }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);
    vi.mocked(authService.validateSession).mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.id).toBe('user-123');
    expect(data.user.lineSub).toBe('test-line-sub');
    expect(data.user.displayName).toBe('Test User');
    expect(authService.validateSession).toHaveBeenCalledWith('session-123');
  });

  test('セッションクッキーがない場合は401エラーが返される', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  test('無効なセッションで401エラーが返される', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue({ value: 'invalid-session' }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);
    vi.mocked(authService.validateSession).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('INVALID_SESSION');
  });

  test('期限切れセッションで401エラーが返される', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue({ value: 'expired-session' }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);
    vi.mocked(authService.validateSession).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('INVALID_SESSION');
    expect(data.error.message).toContain('expired');
  });
});
