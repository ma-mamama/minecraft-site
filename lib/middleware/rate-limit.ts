/**
 * Rate Limiting Middleware
 * Implements simple in-memory rate limiting for API endpoints
 * Requirements: 7.4, 8.1, 8.2
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
// In production, use Redis or similar distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number;
  
  /**
   * Time window in seconds
   */
  windowSeconds: number;
  
  /**
   * Key generator function to identify unique clients
   * Default: uses IP address
   */
  keyGenerator?: (request: Request) => string;
  
  /**
   * Skip rate limiting (useful for testing)
   */
  skip?: boolean;
}

/**
 * Default key generator using IP address
 */
function defaultKeyGenerator(request: Request): string {
  // Try to get real IP from headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to a generic key if IP cannot be determined
  return 'unknown';
}

/**
 * Check if a request should be rate limited
 * Returns true if request should be allowed, false if rate limit exceeded
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  // Skip rate limiting if configured (e.g., in tests)
  if (config.skip) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: Date.now() + config.windowSeconds * 1000,
    };
  }
  
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;
  const key = keyGenerator(request);
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  let entry = rateLimitStore.get(key);
  
  // Create new entry if doesn't exist or expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Increment count
  entry.count++;
  
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Create a rate limit response with appropriate headers
 */
export function createRateLimitResponse(
  remaining: number,
  resetAt: number
): Response {
  const resetInSeconds = Math.ceil((resetAt - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetInSeconds.toString(),
        'Retry-After': resetInSeconds.toString(),
      },
    }
  );
}

/**
 * Apply rate limiting to a request handler
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = checkRateLimit(request, {
 *     maxRequests: 10,
 *     windowSeconds: 60,
 *   });
 *   
 *   if (!rateLimitResult.allowed) {
 *     return createRateLimitResponse(
 *       rateLimitResult.remaining,
 *       rateLimitResult.resetAt
 *     );
 *   }
 *   
 *   // Handle request...
 * }
 * ```
 */
