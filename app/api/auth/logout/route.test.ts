/**
 * Tests for Logout API Route
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/services/auth', () => ({
  invalidateSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { POST } from './route';
import { NextRequest } from 'next/server';
import * as authService from '@/lib/services/auth';
import { cookies } from 'next/headers';

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test('有効なセッションでログアウトが成功する', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue({ value: 'session-123' }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);
    vi.mocked(authService.invalidateSession).mockResolvedValue();

    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(authService.invalidateSession).toHaveBeenCalledWith('session-123');
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  test('セッションがない場合でも成功する', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);

    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(authService.invalidateSession).not.toHaveBeenCalled();
  });

  test('セッション無効化が失敗してもクッキーはクリアされる', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue({ value: 'session-123' }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);
    vi.mocked(authService.invalidateSession).mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
