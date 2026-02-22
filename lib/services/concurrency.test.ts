/**
 * Tests for Concurrency Control Service
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock Supabase
vi.mock('../supabase/server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

import { acquireOperationLock, releaseOperationLock, cleanupExpiredLocks } from './concurrency';
import { supabaseServer } from '../supabase/server';

describe('Concurrency Control Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('acquireOperationLock', () => {
    test('ロックが正常に取得できる', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { lock_id: 'lock-123' },
            error: null,
          }),
        }),
      });

      vi.mocked(supabaseServer.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const lockId = await acquireOperationLock('start');

      expect(lockId).toBeTruthy();
      expect(lockId).toMatch(/^ec2-operation-\d+$/);
      expect(supabaseServer.from).toHaveBeenCalledWith('operation_locks');
    });

    test('既存のロックがある場合はnullが返される', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'UNIQUE_VIOLATION' },
          }),
        }),
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { lock_id: 'existing-lock' },
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(supabaseServer.from)
        .mockReturnValueOnce({
          insert: mockInsert,
        } as any)
        .mockReturnValueOnce({
          select: mockSelect,
        } as any);

      const lockId = await acquireOperationLock('start');

      expect(lockId).toBeNull();
    });
  });

  describe('releaseOperationLock', () => {
    test('ロックが正常に解放される', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      vi.mocked(supabaseServer.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await releaseOperationLock('lock-123');

      expect(supabaseServer.from).toHaveBeenCalledWith('operation_locks');
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredLocks', () => {
    test('期限切れのロックが削除される', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      vi.mocked(supabaseServer.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await cleanupExpiredLocks();

      expect(supabaseServer.from).toHaveBeenCalledWith('operation_locks');
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  // Feature: minecraft-server-control, Property 12: Concurrent operation serialization
  describe('Property 12: Concurrent operation serialization', () => {
    test('複数の並行リクエストに対して1つのロックのみが取得される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('start', 'stop'),
          fc.integer({ min: 2, max: 10 }),
          async (operationType, concurrentRequests) => {
            // Setup: Mock the database to simulate real locking behavior
            let lockAcquired = false;
            const acquiredLockId = `ec2-operation-${Date.now()}`;

            const mockInsert = vi.fn().mockImplementation(() => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(async () => {
                  if (!lockAcquired) {
                    lockAcquired = true;
                    return {
                      data: { lock_id: acquiredLockId },
                      error: null,
                    };
                  } else {
                    return {
                      data: null,
                      error: { code: 'UNIQUE_VIOLATION' },
                    };
                  }
                }),
              }),
            }));

            const mockSelect = vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: lockAcquired ? { lock_id: acquiredLockId } : null,
                    error: null,
                  }),
                }),
              }),
            });

            vi.mocked(supabaseServer.from).mockImplementation((table: string) => {
              if (table === 'operation_locks') {
                return {
                  insert: mockInsert,
                  select: mockSelect,
                } as any;
              }
              return {} as any;
            });

            // Execute: Attempt to acquire multiple locks concurrently
            const lockPromises = Array.from({ length: concurrentRequests }, () =>
              acquireOperationLock(operationType)
            );

            const results = await Promise.all(lockPromises);

            // Verify: Exactly one lock should be acquired, others should be null
            const successfulLocks = results.filter((lockId) => lockId !== null);
            const failedLocks = results.filter((lockId) => lockId === null);

            expect(successfulLocks.length).toBe(1);
            expect(failedLocks.length).toBe(concurrentRequests - 1);

            // Cleanup
            lockAcquired = false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('ロック解放後は新しいロックが取得可能になる', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('start', 'stop'),
          async (operationType) => {
            // Setup: Mock successful lock acquisition
            let lockAcquired = false;
            const firstLockId = `ec2-operation-${Date.now()}-1`;
            const secondLockId = `ec2-operation-${Date.now()}-2`;

            const mockInsert = vi.fn().mockImplementation(() => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(async () => {
                  if (!lockAcquired) {
                    lockAcquired = true;
                    return {
                      data: { lock_id: lockAcquired ? firstLockId : secondLockId },
                      error: null,
                    };
                  } else {
                    return {
                      data: null,
                      error: { code: 'UNIQUE_VIOLATION' },
                    };
                  }
                }),
              }),
            }));

            const mockDelete = vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation(async () => {
                lockAcquired = false;
                return {
                  data: null,
                  error: null,
                };
              }),
            }));

            const mockSelect = vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: lockAcquired ? { lock_id: firstLockId } : null,
                    error: null,
                  }),
                }),
              }),
            });

            vi.mocked(supabaseServer.from).mockImplementation((table: string) => {
              if (table === 'operation_locks') {
                return {
                  insert: mockInsert,
                  delete: mockDelete,
                  select: mockSelect,
                } as any;
              }
              return {} as any;
            });

            // Execute: Acquire lock, release it, then acquire again
            const lock1 = await acquireOperationLock(operationType);
            expect(lock1).not.toBeNull();

            await releaseOperationLock(lock1!);

            const lock2 = await acquireOperationLock(operationType);
            expect(lock2).not.toBeNull();

            // Cleanup
            lockAcquired = false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('異なる操作タイプは独立してロックを取得できる', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Setup: Track locks by operation type
            const locks: Record<string, boolean> = {
              start: false,
              stop: false,
            };

            const mockInsert = vi.fn().mockImplementation((lockData: any) => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(async () => {
                  const opType = lockData.operation_type;
                  if (!locks[opType]) {
                    locks[opType] = true;
                    return {
                      data: { lock_id: `ec2-operation-${opType}-${Date.now()}` },
                      error: null,
                    };
                  } else {
                    return {
                      data: null,
                      error: { code: 'UNIQUE_VIOLATION' },
                    };
                  }
                }),
              }),
            }));

            const mockSelect = vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation((field: string, value: string) => ({
                gte: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: locks[value] ? { lock_id: `lock-${value}` } : null,
                    error: null,
                  }),
                }),
              })),
            }));

            vi.mocked(supabaseServer.from).mockImplementation((table: string) => {
              if (table === 'operation_locks') {
                return {
                  insert: mockInsert,
                  select: mockSelect,
                } as any;
              }
              return {} as any;
            });

            // Execute: Acquire locks for both start and stop simultaneously
            const [startLock, stopLock] = await Promise.all([
              acquireOperationLock('start'),
              acquireOperationLock('stop'),
            ]);

            // Verify: Both locks should be acquired successfully
            expect(startLock).not.toBeNull();
            expect(stopLock).not.toBeNull();

            // Cleanup
            locks.start = false;
            locks.stop = false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
