/**
 * Development Mode Check API Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

// Mock dependencies
vi.mock('@/lib/services/auth', () => ({
  isDevModeEnabled: vi.fn(),
}));

import { isDevModeEnabled } from '@/lib/services/auth';

describe('GET /api/auth/dev-mode-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('開発モードが有効の場合はtrueを返す', async () => {
    vi.mocked(isDevModeEnabled).mockReturnValue(true);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enabled).toBe(true);
  });

  it('開発モードが無効の場合はfalseを返す', async () => {
    vi.mocked(isDevModeEnabled).mockReturnValue(false);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enabled).toBe(false);
  });
});
