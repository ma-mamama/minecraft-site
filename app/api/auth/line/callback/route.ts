/**
 * LINE Login Callback API Route
 * Handles OAuth callback from LINE, verifies token, and creates session
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyLineToken,
  isWhitelisted,
  createSession,
  createUser,
  getSessionCookieOptions,
} from '@/lib/services/auth';
import {
  validateInvitationCode,
  consumeInvitationCode,
} from '@/lib/services/invitation';
import {
  checkRateLimit,
  createRateLimitResponse,
} from '@/lib/middleware/rate-limit';
import { sanitizeString } from '@/lib/utils/sanitize';

// Input validation schema
const callbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  invitationCode: z.string().optional(),
});

/**
 * POST /api/auth/line/callback
 * Exchange authorization code for ID token, verify, and create session
 */
export async function POST(request: NextRequest) {
  try {
    // Requirement 7.4, 8.1: Rate limiting on authentication endpoints
    // 10 requests per minute per IP
    // Skip rate limiting in test environment
    const rateLimitResult = checkRateLimit(request, {
      maxRequests: 10,
      windowSeconds: 60,
      skip: process.env.NODE_ENV === 'test',
    });

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(
        rateLimitResult.remaining,
        rateLimitResult.resetAt
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = callbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid request parameters',
            details: validation.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { code, invitationCode } = validation.data;

    // Requirement 8.4: Sanitize inputs
    const sanitizedCode = sanitizeString(code);
    const sanitizedInvitationCode = invitationCode
      ? sanitizeString(invitationCode)
      : undefined;

    // Exchange authorization code for ID token
    // Call LINE's token endpoint to exchange code for tokens
    let idToken: string;
    try {
      const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: sanitizedCode,
          redirect_uri: process.env.LINE_CALLBACK_URL || '',
          client_id: process.env.LINE_CHANNEL_ID || '',
          client_secret: process.env.LINE_CHANNEL_SECRET || '',
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        console.error('LINE token exchange failed:', errorData);
        return NextResponse.json(
          {
            error: {
              code: 'TOKEN_EXCHANGE_FAILED',
              message: 'Failed to exchange authorization code',
            },
          },
          { status: 401 }
        );
      }

      const tokenData = await tokenResponse.json();
      idToken = tokenData.id_token;

      if (!idToken) {
        return NextResponse.json(
          {
            error: {
              code: 'MISSING_ID_TOKEN',
              message: 'ID token not received from LINE',
            },
          },
          { status: 401 }
        );
      }
    } catch (error) {
      console.error('Error during token exchange:', error);
      return NextResponse.json(
        {
          error: {
            code: 'TOKEN_EXCHANGE_ERROR',
            message: 'Error exchanging authorization code',
          },
        },
        { status: 500 }
      );
    }

    // Requirement 2.3: Verify ID token before trusting user information
    let lineUser;
    try {
      lineUser = await verifyLineToken(idToken);
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed',
          },
        },
        { status: 401 }
      );
    }

    // Requirement 2.4: Extract LINE_Sub from verified token
    const lineSub = lineUser.sub;

    // Check if user is whitelisted
    const whitelisted = await isWhitelisted(lineSub);

    // If not whitelisted, check for invitation code
    if (!whitelisted) {
      if (!sanitizedInvitationCode) {
        // Requirement 2.6: Reject non-whitelisted users without invitation
        return NextResponse.json(
          {
            error: {
              code: 'ACCESS_DENIED',
              message: 'Access denied. Please use an invitation code to register.',
            },
          },
          { status: 403 }
        );
      }

      // Validate invitation code
      // Requirement 1.2, 1.3: Check if code is valid, unused, and not expired
      const validation = await validateInvitationCode(sanitizedInvitationCode);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_INVITATION',
              message: 'Invalid, expired, or already used invitation code',
            },
          },
          { status: 400 }
        );
      }

      // Requirement 1.1, 1.4: Create new user and add to whitelist
      let newUser;
      try {
        newUser = await createUser(lineSub, lineUser.name);
      } catch (error) {
        return NextResponse.json(
          {
            error: {
              code: 'REGISTRATION_FAILED',
              message: 'Failed to create user account',
            },
          },
          { status: 500 }
        );
      }

      // Consume invitation code
      try {
        await consumeInvitationCode(sanitizedInvitationCode, newUser.id);
      } catch (error) {
        console.error('Failed to consume invitation code:', error);
        // Continue anyway since user is created
      }
    }

    // Requirement 2.5, 1.5: Create session for authenticated user
    let session;
    try {
      session = await createSession(lineSub);
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            code: 'SESSION_CREATION_FAILED',
            message: 'Failed to create session',
          },
        },
        { status: 500 }
      );
    }

    // Requirement 7.4: Set secure cookie with HttpOnly, Secure, SameSite=Lax
    const cookieOptions = getSessionCookieOptions();
    const cookieValue = session.id;
    const cookieString = [
      `session=${cookieValue}`,
      `Max-Age=${cookieOptions.maxAge}`,
      `Path=${cookieOptions.path}`,
      cookieOptions.httpOnly ? 'HttpOnly' : '',
      cookieOptions.secure ? 'Secure' : '',
      `SameSite=${cookieOptions.sameSite}`,
    ]
      .filter(Boolean)
      .join('; ');

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: session.user_id,
          lineSub,
        },
      },
      { status: 200 }
    );

    response.headers.set('Set-Cookie', cookieString);

    return response;
  } catch (error) {
    console.error('Unexpected error in LINE callback:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
