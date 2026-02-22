/**
 * Minecraft Server Health Check Service
 * Check if Minecraft server process is actually running inside EC2
 * 
 * Note: Minecraft Bedrock Edition uses UDP protocol which is difficult to check directly.
 * This implementation considers the startup delay after EC2 launch.
 */

import { logError, logInfo, logWarn } from '@/lib/utils/logger';
import { withRetry } from '@/lib/utils/retry';

export type MinecraftServerState = 'online' | 'offline' | 'starting' | 'unknown';

export interface MinecraftServerStatus {
  state: MinecraftServerState;
  timestamp: Date;
}

/**
 * Check if Minecraft server is responding
 * 
 * Strategy:
 * 1. If MINECRAFT_HEALTH_CHECK_URL is set, use HTTP health check
 * 2. Otherwise, check EC2 launch time and assume starting/online based on elapsed time
 * 
 * @param serverHost - The hostname or IP address of the Minecraft server
 * @param port - The port number (default 19132 for Bedrock Edition)
 * @param ec2LaunchTime - EC2 instance launch time (optional)
 * @param timeoutMs - Connection timeout in milliseconds
 * @returns MinecraftServerStatus with current state and timestamp
 */
export async function checkMinecraftServerHealth(
  serverHost: string,
  port: number = 19132,
  ec2LaunchTime?: Date,
  timeoutMs: number = 5000
): Promise<MinecraftServerStatus> {
  try {
    // Check if health check URL is configured
    const healthCheckUrl = process.env.MINECRAFT_HEALTH_CHECK_URL;
    
    if (healthCheckUrl) {
      // Use HTTP health check endpoint
      const isOnline = await withRetry(
        async () => {
          return await checkHttpHealth(healthCheckUrl, timeoutMs);
        },
        { maxAttempts: 2, initialDelayMs: 1000 }
      );

      logInfo('Minecraft server HTTP health check completed', {
        healthCheckUrl,
        isOnline,
      });

      // EC2起動直後（3分以内）でヘルスチェックが失敗した場合は'starting'
      // それ以外でヘルスチェックが失敗した場合は'offline'
      if (!isOnline && ec2LaunchTime) {
        const now = new Date();
        const elapsedSeconds = (now.getTime() - ec2LaunchTime.getTime()) / 1000;
        const startupDelaySeconds = parseInt(
          process.env.MINECRAFT_STARTUP_DELAY_SECONDS || '180',
          10
        );
        
        if (elapsedSeconds < startupDelaySeconds) {
          return {
            state: 'starting',
            timestamp: new Date(),
          };
        }
      }

      return {
        state: isOnline ? 'online' : 'offline',
        timestamp: new Date(),
      };
    } else {
      // No health check configured - use EC2 launch time to estimate
      const startupDelaySeconds = parseInt(
        process.env.MINECRAFT_STARTUP_DELAY_SECONDS || '180',
        10
      );

      if (ec2LaunchTime) {
        const now = new Date();
        const elapsedSeconds = (now.getTime() - ec2LaunchTime.getTime()) / 1000;

        // Always show 'starting' state when no health check is configured
        // This prevents false 'online' status
        logInfo('Minecraft server is starting (no health check configured)', {
          elapsedSeconds,
          startupDelaySeconds,
        });

        return {
          state: 'starting',
          timestamp: new Date(),
        };
      }

      // If no EC2 launch time provided, state is unknown
      logWarn('Cannot determine Minecraft server state without health check or EC2 launch time', {
        serverHost,
        port,
      });

      return {
        state: 'unknown',
        timestamp: new Date(),
      };
    }
  } catch (error) {
    logError('Error checking Minecraft server health', error, {
      serverHost,
      port,
    });

    return {
      state: 'unknown',
      timestamp: new Date(),
    };
  }
}

/**
 * Check HTTP health endpoint
 * 
 * @param url - The health check URL
 * @param timeoutMs - Request timeout in milliseconds
 * @returns true if health check passes, false otherwise
 */
async function checkHttpHealth(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Add Authorization header if token is configured
    const headers: HeadersInit = {};
    const healthCheckToken = process.env.HEALTH_CHECK_TOKEN;
    if (healthCheckToken) {
      headers['Authorization'] = `Bearer ${healthCheckToken}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Consider 2xx status codes as healthy
    return response.ok;
  } catch (error) {
    // Network error or timeout
    return false;
  }
}
