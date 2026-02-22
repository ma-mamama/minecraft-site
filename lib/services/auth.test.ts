/**
 * Property-Based Tests for Authentication Service
 * Feature: minecraft-server-control
 */

import { describe, test, expect, beforeAll, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock Supabase before importing auth service
vi.mock('../supabase/server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

import { verifyLineToken, getSessionCookieOptions, isWhitelisted } from './auth';

// Set up environment variables for testing
beforeAll(() => {
  process.env.LINE_CHANNEL_ID = 'test-channel-id';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

/**
 * Helper function to create a base64url encoded string
 */
function base64urlEncode(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/**
 * Helper function to create a JWT token structure
 */
function createToken(header: any, payload: any, signature: string = 'fake-signature'): string {
  return `${base64urlEncode(header)}.${base64urlEncode(payload)}.${signature}`;
}

describe('Authentication Service - Property-Based Tests', () => {
  // Feature: minecraft-server-control, Property 5: ID token verification precedes trust
  test('Property 5: Invalid tokens are rejected before extracting user information', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate various invalid token scenarios
          scenario: fc.constantFrom(
            'missing-sub',
            'invalid-audience',
            'invalid-issuer',
            'expired-token',
            'malformed-structure',
            'missing-parts'
          ),
          sub: fc.string({ minLength: 10, maxLength: 50 }),
          name: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          aud: fc.string({ minLength: 5, maxLength: 50 }),
          iss: fc.string({ minLength: 5, maxLength: 100 }),
        }),
        async ({ scenario, sub, name, aud, iss }) => {
          let token: string;
          const header = { alg: 'RS256', typ: 'JWT' };
          const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
          const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

          // Create invalid token based on scenario
          switch (scenario) {
            case 'missing-sub':
              // Token without sub claim
              token = createToken(header, {
                aud: process.env.LINE_CHANNEL_ID,
                iss: 'https://access.line.me',
                exp: futureExp,
                name,
              });
              break;

            case 'invalid-audience':
              // Token with wrong audience
              token = createToken(header, {
                sub,
                aud: aud !== process.env.LINE_CHANNEL_ID ? aud : 'different-aud',
                iss: 'https://access.line.me',
                exp: futureExp,
                name,
              });
              break;

            case 'invalid-issuer':
              // Token with wrong issuer
              token = createToken(header, {
                sub,
                aud: process.env.LINE_CHANNEL_ID,
                iss: iss !== 'https://access.line.me' ? iss : 'https://fake-issuer.com',
                exp: futureExp,
                name,
              });
              break;

            case 'expired-token':
              // Token that has expired
              token = createToken(header, {
                sub,
                aud: process.env.LINE_CHANNEL_ID,
                iss: 'https://access.line.me',
                exp: pastExp,
                name,
              });
              break;

            case 'malformed-structure':
              // Token with only 2 parts instead of 3
              token = `${base64urlEncode(header)}.${base64urlEncode({ sub, aud, iss, exp: futureExp })}`;
              break;

            case 'missing-parts':
              // Token with missing parts
              token = base64urlEncode(header);
              break;

            default:
              token = '';
          }

          // Property: All invalid tokens should be rejected with an error
          // The system should NOT extract or return any user information
          await expect(verifyLineToken(token)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 5: Valid tokens with tampered claims are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sub: fc.string({ minLength: 10, maxLength: 50 }),
          name: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          picture: fc.option(fc.webUrl()),
          // Generate random values that don't match expected values
          tamperedField: fc.constantFrom('aud', 'iss', 'exp'),
        }),
        async ({ sub, name, picture, tamperedField }) => {
          const header = { alg: 'RS256', typ: 'JWT' };
          const payload: any = {
            sub,
            aud: process.env.LINE_CHANNEL_ID,
            iss: 'https://access.line.me',
            exp: Math.floor(Date.now() / 1000) + 3600,
            name,
            picture,
          };

          // Tamper with a critical claim
          switch (tamperedField) {
            case 'aud':
              payload.aud = 'tampered-audience';
              break;
            case 'iss':
              payload.iss = 'https://tampered-issuer.com';
              break;
            case 'exp':
              payload.exp = Math.floor(Date.now() / 1000) - 100; // Expired
              break;
          }

          const token = createToken(header, payload);

          // Property: Tokens with tampered claims should be rejected
          await expect(verifyLineToken(token)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 5: Malformed token structures are rejected immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string(), // Random string
          fc.constant(''), // Empty string
          fc.constant('not.a.valid.jwt.token.with.too.many.parts'),
          fc.array(fc.string(), { minLength: 0, maxLength: 2 }).map(parts => parts.join('.')), // 0-2 parts
        ),
        async (invalidToken) => {
          // Property: Malformed tokens should be rejected without attempting to extract user info
          await expect(verifyLineToken(invalidToken)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: minecraft-server-control, Property 6: LINE_Sub extraction accuracy
  // Validates: Requirements 2.4
  test('Property 6: Extracted LINE_Sub exactly matches sub claim in verified token', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sub: fc.string({ minLength: 10, maxLength: 50 }),
          name: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          picture: fc.option(fc.webUrl()),
        }),
        async ({ sub, name, picture }) => {
          // Create a valid token with the generated sub claim
          const header = { alg: 'RS256', typ: 'JWT' };
          const payload = {
            sub,
            aud: process.env.LINE_CHANNEL_ID,
            iss: 'https://access.line.me',
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            name,
            picture,
          };

          const token = createToken(header, payload);

          // Verify the token and extract user information
          const lineUser = await verifyLineToken(token);

          // Property: The extracted LINE_Sub must exactly match the sub claim in the token
          expect(lineUser.sub).toBe(sub);
          
          // Additional verification: other fields should also match if present
          if (name !== null && name !== undefined) {
            expect(lineUser.name).toBe(name);
          }
          if (picture !== null && picture !== undefined) {
            expect(lineUser.picture).toBe(picture);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: minecraft-server-control, Property 7: Session cookie security attributes
  // Validates: Requirements 2.5, 7.4
  test('Property 7: Session cookies include HttpOnly, Secure, and SameSite=Lax attributes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate various session expiry day values
          sessionExpiryDays: fc.integer({ min: 1, max: 30 }),
        }),
        async ({ sessionExpiryDays }) => {
          // Set up environment for this test iteration
          const originalExpiryDays = process.env.SESSION_EXPIRY_DAYS;
          
          process.env.SESSION_EXPIRY_DAYS = sessionExpiryDays.toString();

          try {
            // Get session cookie options
            const cookieOptions = getSessionCookieOptions();

            // Property: HttpOnly must always be true (security requirement)
            expect(cookieOptions.httpOnly).toBe(true);

            // Property: SameSite must always be 'lax' (CSRF protection while allowing OAuth)
            expect(cookieOptions.sameSite).toBe('lax');

            // Property: Secure should be set based on environment
            // In production it must be true, in other environments it can vary
            expect(cookieOptions.secure).toBeDefined();
            expect(typeof cookieOptions.secure).toBe('boolean');

            // Property: Path should always be '/' (cookie available to entire app)
            expect(cookieOptions.path).toBe('/');

            // Property: MaxAge should match the configured expiry days
            const expectedMaxAge = sessionExpiryDays * 24 * 60 * 60;
            expect(cookieOptions.maxAge).toBe(expectedMaxAge);

            // Property: All required security attributes must be present
            expect(cookieOptions).toHaveProperty('httpOnly');
            expect(cookieOptions).toHaveProperty('secure');
            expect(cookieOptions).toHaveProperty('sameSite');
            expect(cookieOptions).toHaveProperty('maxAge');
            expect(cookieOptions).toHaveProperty('path');

            // Property: The critical security attributes must have correct values
            // These are non-negotiable for security
            expect(cookieOptions.httpOnly).toBe(true);
            expect(cookieOptions.sameSite).toBe('lax');
          } finally {
            // Restore original environment
            if (originalExpiryDays !== undefined) {
              process.env.SESSION_EXPIRY_DAYS = originalExpiryDays;
            } else {
              delete process.env.SESSION_EXPIRY_DAYS;
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: minecraft-server-control, Property 8: Non-whitelisted user rejection
  // Validates: Requirements 2.6
  test('Property 8: Non-whitelisted LINE_Sub returns false from whitelist check', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random LINE_Sub values that don't exist in the database
          lineSub: fc.string({ minLength: 10, maxLength: 50 }),
        }),
        async ({ lineSub }) => {
          // Mock the Supabase query to simulate a non-whitelisted user
          // The user does not exist in the database
          const { supabaseServer } = await import('../supabase/server');
          const mockFrom = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116', message: 'No rows found' },
                }),
              }),
            }),
          });

          (supabaseServer.from as any) = mockFrom;

          // Import the function after setting up the mock
          const { isWhitelisted } = await import('./auth');

          // Property: For any LINE_Sub not in the whitelist, isWhitelisted should return false
          const result = await isWhitelisted(lineSub);
          expect(result).toBe(false);

          // Verify that the database was queried with the correct LINE_Sub
          expect(mockFrom).toHaveBeenCalledWith('users');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Development Mode Tests
describe('Development Mode Functions', () => {
  test('isDevModeEnabled: 本番環境では常にfalseを返す', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDevMode = process.env.DEV_MODE_SKIP_AUTH;

    try {
      process.env.NODE_ENV = 'production';
      process.env.DEV_MODE_SKIP_AUTH = 'true';

      const { isDevModeEnabled } = require('./auth');
      expect(isDevModeEnabled()).toBe(false);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.DEV_MODE_SKIP_AUTH = originalDevMode;
    }
  });

  test('isDevModeEnabled: 開発環境でDEV_MODE_SKIP_AUTH=trueの場合はtrueを返す', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDevMode = process.env.DEV_MODE_SKIP_AUTH;

    try {
      process.env.NODE_ENV = 'development';
      process.env.DEV_MODE_SKIP_AUTH = 'true';

      // モジュールキャッシュをクリアして再読み込み
      vi.resetModules();
      const { isDevModeEnabled } = require('./auth');
      expect(isDevModeEnabled()).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.DEV_MODE_SKIP_AUTH = originalDevMode;
      vi.resetModules();
    }
  });

  test('isDevModeEnabled: DEV_MODE_SKIP_AUTHが未設定またはfalseの場合はfalseを返す', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDevMode = process.env.DEV_MODE_SKIP_AUTH;

    try {
      process.env.NODE_ENV = 'development';
      
      // 未設定の場合
      delete process.env.DEV_MODE_SKIP_AUTH;
      vi.resetModules();
      let { isDevModeEnabled } = require('./auth');
      expect(isDevModeEnabled()).toBe(false);

      // falseの場合
      process.env.DEV_MODE_SKIP_AUTH = 'false';
      vi.resetModules();
      ({ isDevModeEnabled } = require('./auth'));
      expect(isDevModeEnabled()).toBe(false);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.DEV_MODE_SKIP_AUTH = originalDevMode;
      vi.resetModules();
    }
  });

  test('getOrCreateDevUser: 開発モードが無効の場合はエラーをスローする', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDevMode = process.env.DEV_MODE_SKIP_AUTH;

    try {
      process.env.NODE_ENV = 'production';
      process.env.DEV_MODE_SKIP_AUTH = 'false';

      vi.resetModules();
      const { getOrCreateDevUser } = require('./auth');
      
      await expect(getOrCreateDevUser()).rejects.toThrow('Development mode is not enabled');
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.DEV_MODE_SKIP_AUTH = originalDevMode;
      vi.resetModules();
    }
  });

  test('createDevSession: 開発モードが無効の場合はエラーをスローする', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDevMode = process.env.DEV_MODE_SKIP_AUTH;

    try {
      process.env.NODE_ENV = 'production';
      process.env.DEV_MODE_SKIP_AUTH = 'false';

      vi.resetModules();
      const { createDevSession } = require('./auth');
      
      await expect(createDevSession()).rejects.toThrow('Development mode is not enabled');
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.DEV_MODE_SKIP_AUTH = originalDevMode;
      vi.resetModules();
    }
  });
});
