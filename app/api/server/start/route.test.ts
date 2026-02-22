/**
 * Tests for Server Start API Route
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/services/auth', () => ({
  validateSession: vi.fn(),
}));

vi.mock('@/lib/services/ec2', () => ({
  startInstance: vi.fn(),
  getInstanceState: vi.fn(),
}));

vi.mock('@/lib/services/concurrency', () => ({
  acquireOperationLock: vi.fn(),
  releaseOperationLock: vi.fn(),
  cleanupExpiredLocks: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { POST } from './route';
import { NextRequest } from 'next/server';
import * as authService from '@/lib/services/auth';
import * as ec2Service from '@/lib/services/ec2';
import * as concurrencyService from '@/lib/services/concurrency';
import { cookies } from 'next/headers';

describe('POST /api/server/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_EC2_INSTANCE_ID = 'i-1234567890abcdef0';
  });

  test('認証済みユーザーがサーバーを起動できる', async () => {
    const mockUser = {
      id: 'user-123',
      line_sub: 'test-line-sub',
      display_name: 'Test User',
      created_at: new Date('2024-01-01'),
      last_login_at: new Date('2024-01-15'),
    };

    const mockInstanceState = {
      state: 'pending' as const,
      timestamp: new Date('2024-01-15T10:00:00Z'),
    };

    const mockCookies = {
      get: vi.fn().mockReturnValue({ value: 'session-123' }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);
    vi.mocked(authService.validateSession).mockResolvedValue(mockUser);
    vi.mocked(concurrencyService.cleanupExpiredLocks).mockResolvedValue(undefined);
    vi.mocked(concurrencyService.acquireOperationLock).mockResolvedValue('lock-123');
    vi.mocked(ec2Service.startInstance).mockResolvedValue(undefined);
    vi.mocked(ec2Service.getInstanceState).mockResolvedValue(mockInstanceState);
    vi.mocked(concurrencyService.releaseOperationLock).mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/server/start', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.state).toBe('pending');
    expect(concurrencyService.acquireOperationLock).toHaveBeenCalledWith('start');
    expect(ec2Service.startInstance).toHaveBeenCalledWith('i-1234567890abcdef0');
    expect(concurrencyService.releaseOperationLock).toHaveBeenCalledWith('lock-123');
  });

  test('セッションがない場合は401エラーが返される', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);

    const request = new NextRequest('http://localhost:3000/api/server/start', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  test('ロックが取得できない場合は409エラーが返される', async () => {
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
    vi.mocked(concurrencyService.cleanupExpiredLocks).mockResolvedValue(undefined);
    vi.mocked(concurrencyService.acquireOperationLock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/server/start', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe('OPERATION_IN_PROGRESS');
  });

  test('無効な状態でstart操作を試みると400エラーが返される', async () => {
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
    vi.mocked(concurrencyService.cleanupExpiredLocks).mockResolvedValue(undefined);
    vi.mocked(concurrencyService.acquireOperationLock).mockResolvedValue('lock-123');
    vi.mocked(ec2Service.startInstance).mockRejectedValue(
      new Error("Cannot start instance in state 'running'. Instance must be stopped.")
    );
    vi.mocked(concurrencyService.releaseOperationLock).mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/server/start', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_STATE');
    expect(concurrencyService.releaseOperationLock).toHaveBeenCalledWith('lock-123');
  });
});
