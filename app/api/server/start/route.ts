/**
 * Server Start API Route
 * Validate state and send start command to EC2 instance
 * Requirements: 4.1, 4.4, 4.5, 7.1, 7.2, 10.1, 10.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/auth';
import { startInstance, getInstanceState } from '@/lib/services/ec2';
import { acquireOperationLock, releaseOperationLock, cleanupExpiredLocks } from '@/lib/services/concurrency';
import { cookies } from 'next/headers';
import { createErrorResponse } from '@/lib/utils/errors';
import { logError, logInfo } from '@/lib/utils/logger';

/**
 * POST /api/server/start
 * Start the EC2 instance if it is in 'stopped' state
 * Requirement 4.1: Send start command to AWS EC2 when state is 'stopped'
 * Requirement 4.4: Prevent start operation when state is not 'stopped'
 * Requirement 4.5: Process only first request when multiple rapid clicks occur
 * Requirement 7.1: Verify session before processing request
 * Requirement 7.2: Verify user is whitelisted
 * Requirement 10.1: Ensure only one start command is sent when multiple users attempt simultaneously
 * Requirement 10.3: Reject new operations while another is in progress
 */
export async function POST(request: NextRequest) {
  let lockId: string | null = null;
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

    // Get EC2 instance ID from environment
    const instanceId = process.env.AWS_EC2_INSTANCE_ID;
    if (!instanceId) {
      console.error('AWS_EC2_INSTANCE_ID not configured');
      return NextResponse.json(
        {
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'Server configuration error',
          },
        },
        { status: 500 }
      );
    }

    // Clean up any expired locks first
    await cleanupExpiredLocks();

    // Requirement 10.1, 10.3: Acquire lock to prevent concurrent operations
    lockId = await acquireOperationLock('start');

    if (!lockId) {
      // Requirement 10.3: Another operation is in progress
      return NextResponse.json(
        {
          error: {
            code: 'OPERATION_IN_PROGRESS',
            message: 'Another operation is already in progress',
          },
        },
        { status: 409 }
      );
    }

    // Requirement 4.1, 4.4: Start instance (validates state internally)
    await startInstance(instanceId);

    // Get updated state
    const instanceState = await getInstanceState(instanceId);

    logInfo('Server start operation completed', {
      userId: user.id,
      instanceId,
      newState: instanceState.state,
    });

    // Requirement 4.2: Return new state
    return NextResponse.json(
      {
        success: true,
        state: instanceState.state,
        timestamp: instanceState.timestamp.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    // Requirement 8.5: Log error details server-side, return generic message
    logError('Error starting server', error, {
      userId: user?.id,
      instanceId: process.env.AWS_EC2_INSTANCE_ID,
    });

    // Requirement 4.3: Handle errors gracefully
    return createErrorResponse(error);
  } finally {
    // Requirement 10.4: Release lock when operation completes
    if (lockId) {
      await releaseOperationLock(lockId);
    }
  }
}
