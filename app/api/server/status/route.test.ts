/**
 * Tests for Server Status API Route
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/services/auth', () => ({
  validateSession: vi.fn(),
}));

vi.mock('@/lib/services/ec2', () => ({
  getInstanceState: vi.fn(),
}));

vi.mock('@/lib/services/minecraft', () => ({
  checkMinecraftServerHealth: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { GET } from './route';
import { NextRequest } from 'next/server';
import * as authService from '@/lib/services/auth';
import * as ec2Service from '@/lib/services/ec2';
import * as minecraftService from '@/lib/services/minecraft';
import { cookies } from 'next/headers';

describe('GET /api/server/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_EC2_INSTANCE_ID = 'i-1234567890abcdef0';
    process.env.MINECRAFT_SERVER_HOST = 'mc.example.com';
    process.env.MINECRAFT_SERVER_PORT = '19132';
  });

  test('認証済みユーザーがサーバーステータスを取得できる（EC2稼働中、Minecraftオンライン）', async () => {
    const mockUser = {
      id: 'user-123',
      line_sub: 'test-line-sub',
      display_name: 'Test User',
      created_at: new Date('2024-01-01'),
      last_login_at: new Date('2024-01-15'),
    };

    const mockInstanceState = {
      state: 'running' as const,
      timestamp: new Date('2024-01-15T10:00:00Z'),
    };

    const mockMinecraftStatus = {
      state: 'online' as const,
      timestamp: new Date('2024-01-15T10:00:01Z'),
    };

    const mockCookies = {
      get: vi.fn().mockReturnValue({ value: 'session-123' }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);
    vi.mocked(authService.validateSession).mockResolvedValue(mockUser);
    vi.mocked(ec2Service.getInstanceState).mockResolvedValue(mockInstanceState);
    vi.mocked(minecraftService.checkMinecraftServerHealth).mockResolvedValue(mockMinecraftStatus);

    const request = new NextRequest('http://localhost:3000/api/server/status', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ec2.state).toBe('running');
    expect(data.ec2.timestamp).toBe('2024-01-15T10:00:00.000Z');
    expect(data.minecraft.state).toBe('online');
    expect(data.minecraft.timestamp).toBe('2024-01-15T10:00:01.000Z');
    expect(ec2Service.getInstanceState).toHaveBeenCalledWith('i-1234567890abcdef0');
    expect(minecraftService.checkMinecraftServerHealth).toHaveBeenCalledWith('mc.example.com', 19132);
  });

  test('EC2が停止中の場合はMinecraftステータスをチェックしない', async () => {
    const mockUser = {
      id: 'user-123',
      line_sub: 'test-line-sub',
      display_name: 'Test User',
      created_at: new Date('2024-01-01'),
      last_login_at: new Date('2024-01-15'),
    };

    const mockInstanceState = {
      state: 'stopped' as const,
      timestamp: new Date('2024-01-15T10:00:00Z'),
    };

    const mockCookies = {
      get: vi.fn().mockReturnValue({ value: 'session-123' }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);
    vi.mocked(authService.validateSession).mockResolvedValue(mockUser);
    vi.mocked(ec2Service.getInstanceState).mockResolvedValue(mockInstanceState);

    const request = new NextRequest('http://localhost:3000/api/server/status', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ec2.state).toBe('stopped');
    expect(data.minecraft).toBeNull();
    expect(minecraftService.checkMinecraftServerHealth).not.toHaveBeenCalled();
  });

  test('セッションがない場合は401エラーが返される', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookies as any);

    const request = new NextRequest('http://localhost:3000/api/server/status', {
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

    const request = new NextRequest('http://localhost:3000/api/server/status', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('INVALID_SESSION');
  });

  test('AWS APIエラーで503エラーが返される', async () => {
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
    vi.mocked(ec2Service.getInstanceState).mockRejectedValue(
      new Error('Network timeout')
    );

    const request = new NextRequest('http://localhost:3000/api/server/status', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
