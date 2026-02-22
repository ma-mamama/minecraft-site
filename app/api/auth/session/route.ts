/**
 * Session Validation API Route
 * Validates current session and returns user information
 * Requirements: 7.1, 7.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/auth';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/session
 * Validate current session and return user information
 */
export async function GET(request: NextRequest) {
  try {
    // Get session ID from cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      // Requirement 7.1: No session cookie, return 401
      return NextResponse.json(
        {
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const sessionId = sessionCookie.value;

    // Validate session and get user
    const user = await validateSession(sessionId);

    if (!user) {
      // Session invalid or expired
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SESSION',
            message: 'Session expired, please login again',
          },
        },
        { status: 401 }
      );
    }

    // Return user information
    return NextResponse.json(
      {
        user: {
          id: user.id,
          lineSub: user.line_sub,
          displayName: user.display_name,
          createdAt: user.created_at.toISOString(),
          lastLoginAt: user.last_login_at?.toISOString() || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in session validation:', error);
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
