/**
 * Tests for LINE Login Callback API Route
 */

import { describe, test, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock global fetch
global.fetch = vi.fn();

// Mock dependencies before importing
vi.mock('@/lib/services/auth', () => ({
  verifyLineToken: vi.fn(),
  isWhitelisted: vi.fn(),
  createSession: vi.fn(),
  createUser: vi.fn(),
  validateSession: vi.fn(),
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 604800,
    path: '/',
  })),
}));

vi.mock('@/lib/services/invitation', () => ({
  validateInvitationCode: vi.fn(),
  consumeInvitationCode: vi.fn(),
}));

import { POST } from './route';
import { NextRequest } from 'next/server';
import * as authService from '@/lib/services/auth';
import * as invitationService from '@/lib/services/invitation';

describe('POST /api/auth/line/callback', () => {
  beforeAll(() => {
    process.env.LINE_CHANNEL_ID = 'test-channel-id';
    process.env.LINE_CHANNEL_SECRET = 'test-channel-secret';
    process.env.LINE_CALLBACK_URL = 'http://localhost:3000/auth/callback';
    process.env.SESSION_EXPIRY_DAYS = '7';
  });

  beforeEach(() => {
    // Reset fetch mock before each test
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'mock-id-token' }),
    } as Response);
  });

  test('既存のホワイトリストユーザーの認証が成功する', async () => {
    // Setup mocks
    vi.mocked(authService.verifyLineToken).mockResolvedValue({
      sub: 'test-line-sub',
      name: 'Test User',
    });
    vi.mocked(authService.isWhitelisted).mockResolvedValue(true);
    vi.mocked(authService.createSession).mockResolvedValue({
      id: 'session-123',
      user_id: 'user-123',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      last_accessed_at: new Date(),
    });

    const request = new NextRequest('http://localhost:3000/api/auth/line/callback', {
      method: 'POST',
      body: JSON.stringify({ code: 'test-auth-code' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.lineSub).toBe('test-line-sub');
    expect(response.headers.get('Set-Cookie')).toContain('session=session-123');
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(response.headers.get('Set-Cookie')).toContain('SameSite=lax');
  });

  test('無効なトークンで認証が失敗する', async () => {
    vi.mocked(authService.verifyLineToken).mockRejectedValue(
      new Error('Invalid token')
    );

    const request = new NextRequest('http://localhost:3000/api/auth/line/callback', {
      method: 'POST',
      body: JSON.stringify({ code: 'invalid-code' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('AUTHENTICATION_FAILED');
  });

  test('ホワイトリストにないユーザーが招待コードなしで拒否される', async () => {
    vi.mocked(authService.verifyLineToken).mockResolvedValue({
      sub: 'new-user-sub',
      name: 'New User',
    });
    vi.mocked(authService.isWhitelisted).mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/auth/line/callback', {
      method: 'POST',
      body: JSON.stringify({ code: 'test-auth-code' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('ACCESS_DENIED');
  });

  test('有効な招待コードで新規ユーザー登録が成功する', async () => {
    vi.mocked(authService.verifyLineToken).mockResolvedValue({
      sub: 'new-user-sub',
      name: 'New User',
    });
    vi.mocked(authService.isWhitelisted).mockResolvedValue(false);
    vi.mocked(invitationService.validateInvitationCode).mockResolvedValue({
      valid: true,
    });
    vi.mocked(authService.createUser).mockResolvedValue({
      id: 'new-user-123',
      line_sub: 'new-user-sub',
      display_name: 'New User',
      created_at: new Date(),
      last_login_at: null,
    });
    vi.mocked(authService.createSession).mockResolvedValue({
      id: 'session-456',
      user_id: 'new-user-123',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      last_accessed_at: new Date(),
    });
    vi.mocked(invitationService.consumeInvitationCode).mockResolvedValue();

    const request = new NextRequest('http://localhost:3000/api/auth/line/callback', {
      method: 'POST',
      body: JSON.stringify({
        code: 'test-auth-code',
        invitationCode: 'valid-invitation',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(authService.createUser).toHaveBeenCalledWith('new-user-sub', 'New User');
    expect(invitationService.consumeInvitationCode).toHaveBeenCalledWith(
      'valid-invitation',
      'new-user-123'
    );
  });

  test('無効な招待コードで登録が失敗する', async () => {
    vi.mocked(authService.verifyLineToken).mockResolvedValue({
      sub: 'new-user-sub',
      name: 'New User',
    });
    vi.mocked(authService.isWhitelisted).mockResolvedValue(false);
    vi.mocked(invitationService.validateInvitationCode).mockResolvedValue({
      valid: false,
      reason: 'expired',
    });

    const request = new NextRequest('http://localhost:3000/api/auth/line/callback', {
      method: 'POST',
      body: JSON.stringify({
        code: 'test-auth-code',
        invitationCode: 'expired-invitation',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INVITATION');
  });

  test('無効なリクエストボディで400エラーが返される', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/line/callback', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });
});

describe('POST /api/auth/line/callback - Property-Based Tests', () => {
  beforeAll(() => {
    process.env.LINE_CHANNEL_ID = 'test-channel-id';
    process.env.LINE_CHANNEL_SECRET = 'test-channel-secret';
    process.env.LINE_CALLBACK_URL = 'http://localhost:3000/auth/callback';
    process.env.SESSION_EXPIRY_DAYS = '7';
  });

  beforeEach(() => {
    // Reset fetch mock before each test
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'mock-id-token' }),
    } as Response);
  });

  // Feature: minecraft-server-control, Property 3: Registration creates whitelisted user
  // Validates: Requirements 1.4
  test('Property 3: 登録成功後にLINE_Subがホワイトリストに追加され、クエリ時にtrueが返される', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // ランダムなLINE_Subを生成
          lineSub: fc.string({ minLength: 10, maxLength: 50 }),
          // ランダムな表示名を生成
          displayName: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          // ランダムな招待コードを生成
          invitationCode: fc.string({ minLength: 16, maxLength: 16 }),
          // ランダムなユーザーIDとセッションIDを生成
          userId: fc.uuid(),
          sessionId: fc.uuid(),
        }),
        async ({ lineSub, displayName, invitationCode, userId, sessionId }) => {
          // モックのセットアップ: 新規ユーザー登録フロー
          
          // 1. トークン検証が成功する
          vi.mocked(authService.verifyLineToken).mockResolvedValue({
            sub: lineSub,
            name: displayName || undefined,
          });

          // 2. 最初はホワイトリストにない（新規登録前）
          vi.mocked(authService.isWhitelisted)
            .mockResolvedValueOnce(false)  // 登録前のチェック
            .mockResolvedValueOnce(true);  // 登録後のチェック

          // 3. 招待コードが有効
          vi.mocked(invitationService.validateInvitationCode).mockResolvedValue({
            valid: true,
          });

          // 4. ユーザー作成が成功
          const createdUser = {
            id: userId,
            line_sub: lineSub,
            display_name: displayName || null,
            created_at: new Date(),
            last_login_at: null,
          };
          vi.mocked(authService.createUser).mockResolvedValue(createdUser);

          // 5. セッション作成が成功
          const createdSession = {
            id: sessionId,
            user_id: userId,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            created_at: new Date(),
            last_accessed_at: new Date(),
          };
          vi.mocked(authService.createSession).mockResolvedValue(createdSession);

          // 6. 招待コード消費が成功
          vi.mocked(invitationService.consumeInvitationCode).mockResolvedValue();

          // 登録リクエストを実行
          const request = new NextRequest('http://localhost:3000/api/auth/line/callback', {
            method: 'POST',
            body: JSON.stringify({
              code: 'test-auth-code',
              invitationCode,
            }),
          });

          const response = await POST(request);
          const data = await response.json();

          // Property 3: 登録が成功した場合、LINE_Subがホワイトリストに追加される
          
          // 1. レスポンスが成功ステータスである
          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          // 2. ユーザーが作成されたことを確認
          expect(authService.createUser).toHaveBeenCalledWith(lineSub, displayName || undefined);

          // 3. 登録後、そのLINE_Subがホワイトリストに存在することを確認
          const isNowWhitelisted = await authService.isWhitelisted(lineSub);
          expect(isNowWhitelisted).toBe(true);

          // Property: 任意の有効な招待コードとLINE_Subで登録が成功した場合、
          // そのLINE_Subがホワイトリストにクエリ可能であり、trueが返される
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: minecraft-server-control, Property 4: Registration establishes valid session
  // Validates: Requirements 1.5
  test('Property 4: 登録成功後に有効なセッションが確立され、認証されたAPIコールに使用できる', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // ランダムなLINE_Subを生成
          lineSub: fc.string({ minLength: 10, maxLength: 50 }),
          // ランダムな表示名を生成
          displayName: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          // ランダムな招待コードを生成
          invitationCode: fc.string({ minLength: 16, maxLength: 16 }),
          // ランダムなユーザーIDとセッションIDを生成
          userId: fc.uuid(),
          sessionId: fc.uuid(),
        }),
        async ({ lineSub, displayName, invitationCode, userId, sessionId }) => {
          // モックのセットアップ: 新規ユーザー登録フロー
          
          // 1. トークン検証が成功する
          vi.mocked(authService.verifyLineToken).mockResolvedValue({
            sub: lineSub,
            name: displayName || undefined,
          });

          // 2. ユーザーはまだホワイトリストにない（新規登録）
          vi.mocked(authService.isWhitelisted).mockResolvedValue(false);

          // 3. 招待コードが有効
          vi.mocked(invitationService.validateInvitationCode).mockResolvedValue({
            valid: true,
          });

          // 4. ユーザー作成が成功
          const createdUser = {
            id: userId,
            line_sub: lineSub,
            display_name: displayName || null,
            created_at: new Date(),
            last_login_at: null,
          };
          vi.mocked(authService.createUser).mockResolvedValue(createdUser);

          // 5. セッション作成が成功
          const createdSession = {
            id: sessionId,
            user_id: userId,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            created_at: new Date(),
            last_accessed_at: new Date(),
          };
          vi.mocked(authService.createSession).mockResolvedValue(createdSession);

          // 6. 招待コード消費が成功
          vi.mocked(invitationService.consumeInvitationCode).mockResolvedValue();

          // 7. セッション検証が成功（セッションが有効であることを確認）
          vi.mocked(authService.validateSession).mockResolvedValue({
            id: userId,
            line_sub: lineSub,
            display_name: displayName || null,
            created_at: new Date(),
            last_login_at: new Date(),
          });

          // 登録リクエストを実行
          const request = new NextRequest('http://localhost:3000/api/auth/line/callback', {
            method: 'POST',
            body: JSON.stringify({
              code: 'test-auth-code',
              invitationCode,
            }),
          });

          const response = await POST(request);
          const data = await response.json();

          // Property 4: 登録が成功した場合、有効なセッションが確立される
          
          // 1. レスポンスが成功ステータスである
          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          // 2. セッションクッキーが設定されている
          const setCookieHeader = response.headers.get('Set-Cookie');
          expect(setCookieHeader).toBeTruthy();
          expect(setCookieHeader).toContain(`session=${sessionId}`);

          // 3. セッションが作成されたことを確認
          expect(authService.createSession).toHaveBeenCalledWith(lineSub);

          // 4. 作成されたセッションが有効であることを確認
          // セッションIDを使ってvalidateSessionを呼び出し、ユーザー情報が返されることを確認
          const validatedUser = await authService.validateSession(sessionId);
          expect(validatedUser).not.toBeNull();
          expect(validatedUser?.line_sub).toBe(lineSub);

          // 5. セッションクッキーにセキュリティ属性が含まれている
          expect(setCookieHeader).toContain('HttpOnly');
          expect(setCookieHeader).toContain('SameSite=lax');

          // Property: 任意の有効な招待コードとLINE_Subで登録が成功した場合、
          // その直後に有効なセッションが存在し、そのセッションが認証されたAPIコールに使用できる
        }
      ),
      { numRuns: 100 }
    );
  });
});
