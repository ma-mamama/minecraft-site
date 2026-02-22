/**
 * Development Mode Login API Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';

// Mock dependencies
vi.mock('@/lib/services/auth', () => ({
  isDevModeEnabled: vi.fn(),
  createDevSession: vi.fn(),
  getSessionCookieOptions: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { isDevModeEnabled, createDevSession, getSessionCookieOptions } from '@/lib/services/auth';

describe('POST /api/auth/dev-login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('開発モードが無効の場合は403エラーを返す', async () => {
    vi.mocked(isDevModeEnabled).mockReturnValue(false);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('開発モードが有効になっていません');
    expect(createDevSession).not.toHaveBeenCalled();
  });

  it('開発モードが有効の場合はセッションを作成する', async () => {
    const mockSession = {
      id: 'test-session-id',
      user_id: 'test-user-id',
      expires_at: new Date('2024-12-31'),
      created_at: new Date('2024-01-01'),
      last_accessed_at: new Date('2024-01-01'),
    };

    const mockCookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      maxAge: 604800,
      path: '/',
    };

    vi.mocked(isDevModeEnabled).mockReturnValue(true);
    vi.mocked(createDevSession).mockResolvedValue(mockSession);
    vi.mocked(getSessionCookieOptions).mockReturnValue(mockCookieOptions);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(createDevSession).toHaveBeenCalledOnce();
  });

  it('セッション作成に失敗した場合は500エラーを返す', async () => {
    vi.mocked(isDevModeEnabled).mockReturnValue(true);
    vi.mocked(createDevSession).mockRejectedValue(new Error('Database error'));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('ログインに失敗しました');
  });
});
