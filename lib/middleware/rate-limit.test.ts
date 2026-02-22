/**
 * Rate Limiting Middleware Tests
 * Requirements: 7.4, 8.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, createRateLimitResponse } from './rate-limit';

describe('Rate Limiting', () => {
  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const config = {
        maxRequests: 5,
        windowSeconds: 60,
      };

      // First request should be allowed
      const result1 = checkRateLimit(request, config);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);

      // Second request should be allowed
      const result2 = checkRateLimit(request, config);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    it('should block requests exceeding limit', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.2',
        },
      });

      const config = {
        maxRequests: 2,
        windowSeconds: 60,
      };

      // First two requests should be allowed
      checkRateLimit(request, config);
      checkRateLimit(request, config);

      // Third request should be blocked
      const result = checkRateLimit(request, config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different IPs separately', () => {
      const request1 = new Request('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.3',
        },
      });

      const request2 = new Request('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.4',
        },
      });

      const config = {
        maxRequests: 2,
        windowSeconds: 60,
      };

      // Use up limit for first IP
      checkRateLimit(request1, config);
      checkRateLimit(request1, config);
      const result1 = checkRateLimit(request1, config);
      expect(result1.allowed).toBe(false);

      // Second IP should still be allowed
      const result2 = checkRateLimit(request2, config);
      expect(result2.allowed).toBe(true);
    });

    it('should use custom key generator', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'user-id': 'user123',
        },
      });

      const config = {
        maxRequests: 2,
        windowSeconds: 60,
        keyGenerator: (req: Request) => req.headers.get('user-id') || 'unknown',
      };

      // First request should be allowed
      const result1 = checkRateLimit(request, config);
      expect(result1.allowed).toBe(true);

      // Second request should be allowed
      const result2 = checkRateLimit(request, config);
      expect(result2.allowed).toBe(true);

      // Third request should be blocked
      const result3 = checkRateLimit(request, config);
      expect(result3.allowed).toBe(false);
    });

    it('should handle missing IP headers', () => {
      const request = new Request('http://localhost:3000/api/test');

      const config = {
        maxRequests: 2,
        windowSeconds: 60,
      };

      // Should use fallback key
      const result = checkRateLimit(request, config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('createRateLimitResponse', () => {
    it('should create proper rate limit response', async () => {
      const resetAt = Date.now() + 60000; // 60 seconds from now
      const response = createRateLimitResponse(0, resetAt);

      expect(response.status).toBe(429);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('Retry-After')).toBeTruthy();

      const body = await response.json();
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.message).toContain('Too many requests');
    });
  });
});
