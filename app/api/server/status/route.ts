/**
 * Server Status API Route
 * Query EC2 instance state and return to client
 * Requirements: 3.1, 7.1, 7.2, 10.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/auth';
import { getInstanceState } from '@/lib/services/ec2';
import { checkMinecraftServerHealth } from '@/lib/services/minecraft';
import { cookies } from 'next/headers';
import { createErrorResponse } from '@/lib/utils/errors';
import { logError } from '@/lib/utils/logger';

/**
 * GET /api/server/status
 * Query EC2 instance state and return current status
 * Requirement 3.1: Query EC2 instance state from AWS and display to user
 * Requirement 7.1: Verify session before processing request
 * Requirement 7.2: Verify user is whitelisted
 * Requirement 10.5: Query current state from AWS rather than cached state
 */
export async function GET(request: NextRequest) {
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

    // Requirement 10.5: Query current state from AWS
    const instanceState = await getInstanceState(instanceId);

    // Check Minecraft server health if EC2 is running
    let minecraftState = null;
    if (instanceState.state === 'running') {
      const minecraftHost = process.env.MINECRAFT_SERVER_HOST;
      const minecraftPort = process.env.MINECRAFT_SERVER_PORT
        ? parseInt(process.env.MINECRAFT_SERVER_PORT, 10)
        : 19132;

      if (minecraftHost) {
        // Pass EC2 launch time to check if Minecraft is still starting
        const minecraftStatus = await checkMinecraftServerHealth(
          minecraftHost,
          minecraftPort,
          instanceState.launchTime
        );
        minecraftState = {
          state: minecraftStatus.state,
          timestamp: minecraftStatus.timestamp.toISOString(),
        };
      }
    }

    // Requirement 3.1: Return state to client
    return NextResponse.json(
      {
        ec2: {
          state: instanceState.state,
          timestamp: instanceState.timestamp.toISOString(),
        },
        minecraft: minecraftState,
      },
      { status: 200 }
    );
  } catch (error) {
    // Requirement 8.5: Log error details server-side, return generic message
    logError('Error getting server status', error, {
      userId: user?.id,
    });

    // Requirement 3.6: Handle AWS API errors gracefully
    return createErrorResponse(error);
  }
}
