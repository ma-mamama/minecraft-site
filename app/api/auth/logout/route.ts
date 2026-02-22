/**
 * Logout API Route
 * Invalidates session and clears session cookie
 * Requirements: 2.1, 7.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { invalidateSession } from '@/lib/services/auth';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/logout
 * Invalidate current session and clear cookie
 */
export async function POST(request: NextRequest) {
  try {
    // Get session ID from cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      // No session to invalidate, but return success anyway
      return NextResponse.json(
        { success: true },
        { status: 200 }
      );
    }

    const sessionId = sessionCookie.value;

    // Invalidate session in database
    try {
      await invalidateSession(sessionId);
    } catch (error) {
      console.error('Error invalidating session:', error);
      // Continue to clear cookie even if database operation fails
    }

    // Clear session cookie
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    // Set cookie with Max-Age=0 to delete it
    response.headers.set(
      'Set-Cookie',
      'session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'
    );

    return response;
  } catch (error) {
    console.error('Unexpected error in logout:', error);
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
