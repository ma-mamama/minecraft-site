/**
 * Invitation Code Generation API Route
 * Generate new invitation codes with 5-hour expiration
 * Requirements: 6.1, 6.2, 6.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/auth';
import { generateInvitationCode } from '@/lib/services/invitation';
import { cookies } from 'next/headers';
import { createErrorResponse } from '@/lib/utils/errors';
import { logError, logInfo } from '@/lib/utils/logger';

/**
 * POST /api/invitation/generate
 * Generate a new invitation code with 5-hour expiration
 * Requirement 6.1: Generate unique random code
 * Requirement 6.2: Store with creation timestamp and unused status
 * Requirement 6.3: Set expiration time to 5 hours from creation
 */
export async function POST(request: NextRequest) {
  let user = null;
  
  try {
    // Requirement 7.1: Verify authentication
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
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
    user = await validateSession(sessionId);

    if (!user) {
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

    // Requirement 7.2: User is whitelisted (validated by validateSession)
    // If user exists in database, they are whitelisted

    // Generate invitation code
    const invitationCode = await generateInvitationCode();

    logInfo('Invitation code generated', {
      userId: user.id,
      code: invitationCode.code,
      expiresAt: invitationCode.expires_at,
    });

    return NextResponse.json(
      {
        code: invitationCode.code,
        expiresAt: invitationCode.expires_at.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    // Requirement 8.5: Log error details server-side, return generic message
    logError('Error generating invitation code', error, {
      userId: user?.id,
    });

    return createErrorResponse(error);
  }
}
