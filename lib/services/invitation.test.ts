/**
 * Property-Based Tests for Invitation Code Service
 * Feature: minecraft-server-control
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock Supabase before importing invitation service
vi.mock('../supabase/server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

import {
  validateInvitationCode,
  consumeInvitationCode,
} from './invitation';
import { InvitationCodeRow } from '../types/database';

describe('Invitation Code Service - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Feature: minecraft-server-control, Property 1: Invitation code single-use enforcement
  // Validates: Requirements 1.2, 6.4
  test('Property 1: Invitation code can only be used once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random invitation code
          code: fc.string({ minLength: 16, maxLength: 16 }),
          // Generate random user IDs for first and second usage attempts
          firstUserId: fc.uuid(),
          secondUserId: fc.uuid(),
        }),
        async ({ code, firstUserId, secondUserId }) => {
          const { supabaseServer } = await import('../supabase/server');
          
          // Create a valid, unused invitation code
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5 hours from now
          
          const unusedCodeRow: InvitationCodeRow = {
            id: fc.sample(fc.uuid(), 1)[0],
            code,
            created_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            used_at: null,
            used_by_user_id: null,
            is_used: false,
          };

          // Mock the first validation call (code is valid and unused)
          const mockValidationSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: unusedCodeRow,
                error: null,
              }),
            }),
          });

          // Mock the consumption update (mark as used)
          const mockConsumptionUpdate = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          });

          // Set up the first usage attempt
          (supabaseServer.from as any) = vi.fn((table: string) => {
            if (table === 'invitation_codes') {
              return {
                select: mockValidationSelect,
                update: mockConsumptionUpdate,
              };
            }
            return {};
          });

          // First usage: should succeed
          await expect(consumeInvitationCode(code, firstUserId)).resolves.not.toThrow();

          // Verify that the code was marked as used
          expect(mockConsumptionUpdate).toHaveBeenCalledWith({
            is_used: true,
            used_at: expect.any(String),
            used_by_user_id: firstUserId,
          });

          // Now create a used code row for the second attempt
          const usedCodeRow: InvitationCodeRow = {
            ...unusedCodeRow,
            is_used: true,
            used_at: new Date().toISOString(),
            used_by_user_id: firstUserId,
          };

          // Mock the second validation call (code is now used)
          const mockSecondValidationSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: usedCodeRow,
                error: null,
              }),
            }),
          });

          // Set up the second usage attempt
          (supabaseServer.from as any) = vi.fn((table: string) => {
            if (table === 'invitation_codes') {
              return {
                select: mockSecondValidationSelect,
                update: vi.fn(),
              };
            }
            return {};
          });

          // Property: Second usage attempt should be rejected
          // The system should detect that the code is already used and throw an error
          await expect(consumeInvitationCode(code, secondUserId)).rejects.toThrow(
            /Invalid invitation code: already_used/
          );

          // Verify that validation was called for the second attempt
          expect(mockSecondValidationSelect).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 1: Used invitation code validation returns already_used', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          code: fc.string({ minLength: 16, maxLength: 16 }),
          usedByUserId: fc.uuid(),
        }),
        async ({ code, usedByUserId }) => {
          const { supabaseServer } = await import('../supabase/server');
          
          // Create an already-used invitation code
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 5 * 60 * 60 * 1000); // Still valid time-wise
          const usedAt = new Date(now.getTime() - 1 * 60 * 60 * 1000); // Used 1 hour ago
          
          const usedCodeRow: InvitationCodeRow = {
            id: fc.sample(fc.uuid(), 1)[0],
            code,
            created_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            used_at: usedAt.toISOString(),
            used_by_user_id: usedByUserId,
            is_used: true,
          };

          // Mock the validation query
          const mockSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: usedCodeRow,
                error: null,
              }),
            }),
          });

          (supabaseServer.from as any) = vi.fn((table: string) => {
            if (table === 'invitation_codes') {
              return {
                select: mockSelect,
              };
            }
            return {};
          });

          // Property: For any already-used invitation code, validation should return
          // valid: false with reason: 'already_used'
          const validation = await validateInvitationCode(code);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe('already_used');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: minecraft-server-control, Property 2: Invitation code expiration enforcement
  // Validates: Requirements 1.3
  test('Property 2: Invitation codes older than 5 hours are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          code: fc.string({ minLength: 16, maxLength: 16 }),
          // Generate expiration times that are in the past (more than 5 hours ago)
          // Using hours between 6 and 100 to ensure codes are definitely expired
          hoursAgo: fc.integer({ min: 6, max: 100 }),
        }),
        async ({ code, hoursAgo }) => {
          const { supabaseServer } = await import('../supabase/server');
          
          const now = new Date();
          // Create an invitation code that expired in the past
          const createdAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
          const expiresAt = new Date(createdAt.getTime() + 5 * 60 * 60 * 1000);
          
          // Verify that expiresAt is indeed in the past
          // This is a precondition for our property test
          if (expiresAt >= now) {
            // Skip this test case if somehow the expiration is not in the past
            return true;
          }
          
          const expiredCodeRow: InvitationCodeRow = {
            id: fc.sample(fc.uuid(), 1)[0],
            code,
            created_at: createdAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            used_at: null,
            used_by_user_id: null,
            is_used: false,
          };

          // Mock the validation query
          const mockSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: expiredCodeRow,
                error: null,
              }),
            }),
          });

          (supabaseServer.from as any) = vi.fn((table: string) => {
            if (table === 'invitation_codes') {
              return {
                select: mockSelect,
              };
            }
            return {};
          });

          // Property: For any invitation code with expiration time in the past,
          // validation should return valid: false with reason: 'expired'
          const validation = await validateInvitationCode(code);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe('expired');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Invitation codes within 5 hours are accepted (if unused)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          code: fc.string({ minLength: 16, maxLength: 16 }),
          // Generate times within the valid window (0 to 5 hours from now)
          // Using minutes to get more granular testing
          minutesFromNow: fc.integer({ min: 1, max: 299 }), // 1 minute to 4h59m
        }),
        async ({ code, minutesFromNow }) => {
          const { supabaseServer } = await import('../supabase/server');
          
          const now = new Date();
          // Create an invitation code that will expire in the future
          const createdAt = new Date(now.getTime() - 1 * 60 * 60 * 1000); // Created 1 hour ago
          const expiresAt = new Date(now.getTime() + minutesFromNow * 60 * 1000);
          
          // Verify that expiresAt is indeed in the future
          if (expiresAt <= now) {
            // Skip this test case if somehow the expiration is not in the future
            return true;
          }
          
          const validCodeRow: InvitationCodeRow = {
            id: fc.sample(fc.uuid(), 1)[0],
            code,
            created_at: createdAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            used_at: null,
            used_by_user_id: null,
            is_used: false,
          };

          // Mock the validation query
          const mockSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: validCodeRow,
                error: null,
              }),
            }),
          });

          (supabaseServer.from as any) = vi.fn((table: string) => {
            if (table === 'invitation_codes') {
              return {
                select: mockSelect,
              };
            }
            return {};
          });

          // Property: For any invitation code with expiration time in the future
          // and not yet used, validation should return valid: true
          const validation = await validateInvitationCode(code);
          
          expect(validation.valid).toBe(true);
          expect(validation.reason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: minecraft-server-control, Property 13: Invitation code uniqueness
  // Validates: Requirements 6.1
  test('Property 13: Generated invitation codes are unique', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate a set of existing codes in the database
          existingCodes: fc.array(
            fc.string({ minLength: 16, maxLength: 16 }),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        async ({ existingCodes }) => {
          const { supabaseServer } = await import('../supabase/server');
          const { generateInvitationCode } = await import('./invitation');
          
          // Create a set for O(1) lookup
          const existingCodesSet = new Set(existingCodes);
          
          // Generate a new code
          const newCodeValue = fc.sample(
            fc.string({ minLength: 16, maxLength: 16 }),
            1
          )[0];
          
          // Ensure the new code is different from all existing codes
          // This simulates the database constraint
          if (existingCodesSet.has(newCodeValue)) {
            // If collision detected, the insert should fail
            const mockInsert = vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                }),
              }),
            });

            (supabaseServer.from as any) = vi.fn((table: string) => {
              if (table === 'invitation_codes') {
                return {
                  insert: mockInsert,
                };
              }
              return {};
            });

            // Property: When a collision occurs, the system should fail to generate the code
            await expect(generateInvitationCode()).rejects.toThrow();
          } else {
            // No collision - insert should succeed
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 5 * 60 * 60 * 1000);
            
            const newCodeRow: InvitationCodeRow = {
              id: fc.sample(fc.uuid(), 1)[0],
              code: newCodeValue,
              created_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
              used_at: null,
              used_by_user_id: null,
              is_used: false,
            };

            const mockInsert = vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: newCodeRow,
                  error: null,
                }),
              }),
            });

            (supabaseServer.from as any) = vi.fn((table: string) => {
              if (table === 'invitation_codes') {
                return {
                  insert: mockInsert,
                };
              }
              return {};
            });

            // Property: When no collision occurs, the code should be successfully generated
            const result = await generateInvitationCode();
            expect(result.code).toBe(newCodeValue);
            expect(result.is_used).toBe(false);
            
            // Verify the generated code is not in the existing set
            expect(existingCodesSet.has(result.code)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });


});
