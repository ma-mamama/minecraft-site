/**
 * Property-Based Tests for Authentication Requirement
 * Feature: minecraft-server-control, Property 14: Authentication required for all APIs
 * Validates: Requirements 7.1
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/services/auth', () => ({
  validateSession: vi.fn(),
  invalidateSession: vi.fn(),
}));

vi.mock('@/lib/services/ec2', () => ({
  getInstanceState: vi.fn(),
  startInstance: vi.fn(),
  stopInstance: vi.fn(),
}));

vi.mock('@/lib/services/concurrency', () => ({
  acquireOperationLock: vi.fn(),
  releaseOperationLock: vi.fn(),
  cleanupExpiredLocks: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import * as authService from '@/lib/services/auth';
import { cookies } from 'next/headers';

// Import all protected API route handlers
import { GET as getServerStatus } from './server/status/route';
import { POST as postServerStart } from './server/start/route';
import { POST as postServerStop } from './server/stop/route';
import { GET as getAuthSession } from './auth/session/route';

/**
 * Protected API endpoints that require authentication
 * Each entry contains: [handler, method, path]
 * 
 * Note: POST /api/auth/logout is intentionally excluded because it gracefully
 * handles missing sessions (returns 200 even without a session cookie).
 * This is by design to allow logout attempts even when the session is already invalid.
 */
const protectedEndpoints = [
  { handler: getServerStatus, method: 'GET', path: '/api/server/status' },
  { handler: postServerStart, method: 'POST', path: '/api/server/start' },
  { handler: postServerStop, method: 'POST', path: '/api/server/stop' },
  { handler: getAuthSession, method: 'GET', path: '/api/auth/session' },
] as const;

describe('Authentication Requirement - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_EC2_INSTANCE_ID = 'i-1234567890abcdef0';
  });

  // Feature: minecraft-server-control, Property 14: Authentication required for all APIs
  // Validates: Requirements 7.1
  test('Property 14: All protected API endpoints return 401 without valid session', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate various scenarios for missing or invalid sessions
          sessionScenario: fc.constantFrom(
            'no-cookie',
            'empty-cookie',
            'invalid-session-id',
            'expired-session'
          ),
          sessionId: fc.string({ minLength: 10, maxLength: 50 }),
          endpointIndex: fc.integer({ min: 0, max: protectedEndpoints.length - 1 }),
        }),
        async ({ sessionScenario, sessionId, endpointIndex }) => {
          const endpoint = protectedEndpoints[endpointIndex];
          
          // Set up mock based on session scenario
          const mockCookies = {
            get: vi.fn(),
          };

          switch (sessionScenario) {
            case 'no-cookie':
              // No session cookie present
              mockCookies.get.mockReturnValue(undefined);
              break;

            case 'empty-cookie':
              // Empty session cookie
              mockCookies.get.mockReturnValue({ value: '' });
              vi.mocked(authService.validateSession).mockResolvedValue(null);
              break;

            case 'invalid-session-id':
              // Invalid session ID that doesn't exist in database
              mockCookies.get.mockReturnValue({ value: sessionId });
              vi.mocked(authService.validateSession).mockResolvedValue(null);
              break;

            case 'expired-session':
              // Session ID exists but is expired
              mockCookies.get.mockReturnValue({ value: sessionId });
              vi.mocked(authService.validateSession).mockResolvedValue(null);
              break;
          }

          vi.mocked(cookies).mockResolvedValue(mockCookies as any);

          // Create request for the endpoint
          const request = new NextRequest(`http://localhost:3000${endpoint.path}`, {
            method: endpoint.method,
          });

          // Call the handler
          const response = await endpoint.handler(request);
          const data = await response.json();

          // Property: All protected endpoints must return 401 Unauthorized
          // when there is no valid session
          expect(response.status).toBe(401);
          
          // Property: The error response must indicate authentication is required
          expect(data.error).toBeDefined();
          expect(data.error.code).toMatch(/AUTHENTICATION_REQUIRED|INVALID_SESSION/);
          
          // Property: The error message should be user-friendly
          expect(data.error.message).toBeDefined();
          expect(typeof data.error.message).toBe('string');
          expect(data.error.message.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 14: All protected endpoints reject requests with malformed session cookies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate various malformed session cookie values
          malformedValue: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string({ maxLength: 5 }), // Too short
            fc.string({ minLength: 200 }), // Too long
            fc.constant('{}'), // JSON object
            fc.constant('[]'), // Array
            fc.constant('null'), // String "null"
          ),
          endpointIndex: fc.integer({ min: 0, max: protectedEndpoints.length - 1 }),
        }),
        async ({ malformedValue, endpointIndex }) => {
          const endpoint = protectedEndpoints[endpointIndex];
          
          const mockCookies = {
            get: vi.fn(),
          };

          if (malformedValue === null || malformedValue === undefined) {
            mockCookies.get.mockReturnValue(undefined);
          } else {
            mockCookies.get.mockReturnValue({ value: malformedValue });
            vi.mocked(authService.validateSession).mockResolvedValue(null);
          }

          vi.mocked(cookies).mockResolvedValue(mockCookies as any);

          const request = new NextRequest(`http://localhost:3000${endpoint.path}`, {
            method: endpoint.method,
          });

          const response = await endpoint.handler(request);
          const data = await response.json();

          // Property: Malformed session cookies must result in 401 Unauthorized
          expect(response.status).toBe(401);
          expect(data.error).toBeDefined();
          expect(data.error.code).toMatch(/AUTHENTICATION_REQUIRED|INVALID_SESSION/);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 14: Authentication check occurs before any business logic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          endpointIndex: fc.integer({ min: 0, max: protectedEndpoints.length - 1 }),
        }),
        async ({ endpointIndex }) => {
          const endpoint = protectedEndpoints[endpointIndex];
          
          // Set up scenario where there's no session
          const mockCookies = {
            get: vi.fn().mockReturnValue(undefined),
          };
          vi.mocked(cookies).mockResolvedValue(mockCookies as any);

          // Clear all mocks to track call order
          vi.clearAllMocks();
          vi.mocked(cookies).mockResolvedValue(mockCookies as any);

          const request = new NextRequest(`http://localhost:3000${endpoint.path}`, {
            method: endpoint.method,
          });

          const response = await endpoint.handler(request);

          // Property: When authentication fails, business logic services
          // (EC2, concurrency) should NOT be called
          const ec2Module = await import('@/lib/services/ec2');
          const concurrencyModule = await import('@/lib/services/concurrency');

          expect(vi.mocked(ec2Module.getInstanceState)).not.toHaveBeenCalled();
          expect(vi.mocked(ec2Module.startInstance)).not.toHaveBeenCalled();
          expect(vi.mocked(ec2Module.stopInstance)).not.toHaveBeenCalled();
          
          // For server control endpoints, concurrency locks should not be acquired
          if (endpoint.path.startsWith('/api/server/')) {
            expect(vi.mocked(concurrencyModule.acquireOperationLock)).not.toHaveBeenCalled();
          }

          // Property: Response must still be 401
          expect(response.status).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 14: Consistent 401 response format across all protected endpoints', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          endpointIndex: fc.integer({ min: 0, max: protectedEndpoints.length - 1 }),
        }),
        async ({ endpointIndex }) => {
          const endpoint = protectedEndpoints[endpointIndex];
          
          // No session cookie
          const mockCookies = {
            get: vi.fn().mockReturnValue(undefined),
          };
          vi.mocked(cookies).mockResolvedValue(mockCookies as any);

          const request = new NextRequest(`http://localhost:3000${endpoint.path}`, {
            method: endpoint.method,
          });

          const response = await endpoint.handler(request);
          const data = await response.json();

          // Property: All 401 responses must have consistent structure
          expect(response.status).toBe(401);
          expect(data).toHaveProperty('error');
          expect(data.error).toHaveProperty('code');
          expect(data.error).toHaveProperty('message');
          
          // Property: Error code must be a non-empty string
          expect(typeof data.error.code).toBe('string');
          expect(data.error.code.length).toBeGreaterThan(0);
          
          // Property: Error message must be a non-empty string
          expect(typeof data.error.message).toBe('string');
          expect(data.error.message.length).toBeGreaterThan(0);
          
          // Property: Response should not leak sensitive information
          expect(data.error.message).not.toMatch(/database|sql|query|internal/i);
        }
      ),
      { numRuns: 100 }
    );
  });
});
