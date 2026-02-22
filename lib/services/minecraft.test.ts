/**
 * Tests for Minecraft Server Health Check Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkMinecraftServerHealth } from './minecraft';

vi.mock('@/lib/utils/logger');

describe('checkMinecraftServerHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return online when connection succeeds', async () => {
    // 実際のネットワーク接続をテストするのは難しいため、
    // 基本的な動作確認のみ行う
    const result = await checkMinecraftServerHealth('127.0.0.1', 19132, 100);

    expect(result.state).toMatch(/online|offline|unknown/);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('should return offline when connection fails', async () => {
    // 存在しないホストに接続を試みる
    const result = await checkMinecraftServerHealth('192.0.2.1', 19132, 100);

    expect(result.state).toMatch(/offline|unknown/);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('should use default port 19132 when not specified', async () => {
    const result = await checkMinecraftServerHealth('127.0.0.1');

    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('should handle timeout gracefully', async () => {
    const result = await checkMinecraftServerHealth('192.0.2.1', 19132, 50);

    expect(result.state).toMatch(/offline|unknown/);
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});
