/**
 * EC2 Control Service
 * Handles AWS EC2 instance state queries and control operations
 * Requirements: 3.1, 4.1, 4.4, 5.1, 5.4, 9.1, 9.2, 9.5
 */

import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  InstanceStateName,
} from '@aws-sdk/client-ec2';
import { withRetry } from '@/lib/utils/retry';
import { logError, logInfo } from '@/lib/utils/logger';

/**
 * EC2 instance state as displayed to users
 */
export type EC2State = 'pending' | 'running' | 'stopping' | 'stopped' | 'terminated';

/**
 * EC2 instance state with timestamp
 */
export interface EC2InstanceState {
  state: EC2State;
  timestamp: Date;
  launchTime?: Date;
}

/**
 * Valid operations that can be performed on EC2 instances
 */
export type EC2Operation = 'start' | 'stop';

/**
 * Initialize AWS EC2 client with credentials from environment variables
 * Requirement 9.1: Use IAM credentials with limited permissions
 * Requirement 9.3: Store credentials in server-side environment variables
 */
function createEC2Client(): EC2Client {
  if (!process.env.AWS_REGION) {
    throw new Error('AWS_REGION not configured');
  }
  if (!process.env.AWS_ACCESS_KEY_ID) {
    throw new Error('AWS_ACCESS_KEY_ID not configured');
  }
  if (!process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS_SECRET_ACCESS_KEY not configured');
  }

  return new EC2Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Validate that the target instance ID matches the configured instance
 * Requirement 9.5: Verify target instance ID matches configured instance
 * 
 * @param instanceId - The instance ID to validate
 * @throws Error if instance ID doesn't match configuration
 */
function validateInstanceId(instanceId: string): void {
  const configuredInstanceId = process.env.AWS_EC2_INSTANCE_ID;
  
  if (!configuredInstanceId) {
    throw new Error('AWS_EC2_INSTANCE_ID not configured');
  }
  
  if (instanceId !== configuredInstanceId) {
    throw new Error('Instance ID does not match configured instance');
  }
}

/**
 * Get the current state of an EC2 instance
 * Requirement 3.1: Query EC2 instance state from AWS
 * Requirement 9.2: Use IAM credentials that can only access specific target instance
 * Requirement 10.5: Query current state from AWS rather than relying on cached state
 * 
 * @param instanceId - The EC2 instance ID to query
 * @returns EC2InstanceState object with current state and timestamp
 * @throws Error if AWS API call fails or instance not found
 */
export async function getInstanceState(instanceId: string): Promise<EC2InstanceState> {
  // Requirement 9.5: Validate instance ID before executing command
  validateInstanceId(instanceId);

  const client = createEC2Client();

  try {
    // Requirement 3.6: Retry logic for AWS transient errors
    const response = await withRetry(async () => {
      const command = new DescribeInstancesCommand({
        InstanceIds: [instanceId],
      });
      return await client.send(command);
    });

    // Check if instance exists in response
    if (!response.Reservations || response.Reservations.length === 0) {
      throw new Error('Instance not found');
    }

    const instance = response.Reservations[0].Instances?.[0];
    if (!instance || !instance.State) {
      throw new Error('Instance state not available');
    }

    const stateName = instance.State.Name as InstanceStateName;
    
    // Map AWS state to our EC2State type
    // Requirement 3.1: Display EC2 instance state
    const state: EC2State = stateName as EC2State;

    // Get launch time if available
    const launchTime = instance.LaunchTime;

    logInfo('Retrieved EC2 instance state', {
      instanceId,
      state,
      launchTime,
    });

    return {
      state,
      timestamp: new Date(),
      launchTime: launchTime ? new Date(launchTime) : undefined,
    };
  } catch (error) {
    // Requirement 8.5: Log error details server-side
    logError('Error getting EC2 instance state', error, { instanceId });
    
    // Requirement 9.4: Return generic message to client
    if (error instanceof Error) {
      throw new Error(`Failed to get instance state: ${error.message}`);
    }
    throw new Error('Failed to get instance state');
  }
}

/**
 * Check if an operation can be performed given the current instance state
 * Requirement 4.4: Prevent start operation when state is not 'stopped'
 * Requirement 5.4: Reject stop operation when state is 'pending'
 * 
 * @param currentState - The current EC2 instance state
 * @param operation - The operation to perform ('start' or 'stop')
 * @returns true if operation is allowed, false otherwise
 */
export function canPerformOperation(
  currentState: EC2State,
  operation: EC2Operation
): boolean {
  if (operation === 'start') {
    // Requirement 4.4: Start only allowed when stopped
    return currentState === 'stopped';
  }
  
  if (operation === 'stop') {
    // Requirement 5.4: Stop not allowed when pending
    // Stop only allowed when running
    return currentState === 'running';
  }
  
  return false;
}

/**
 * Start an EC2 instance
 * Requirement 4.1: Send start command to AWS EC2 when state is 'stopped'
 * Requirement 9.1: Use IAM credentials with limited permissions
 * Requirement 9.5: Verify target instance ID before executing command
 * 
 * @param instanceId - The EC2 instance ID to start
 * @throws Error if instance is not in valid state or AWS API call fails
 */
export async function startInstance(instanceId: string): Promise<void> {
  // Requirement 9.5: Validate instance ID before executing command
  validateInstanceId(instanceId);

  // Check current state before attempting to start
  // Requirement 4.4: Validate state before sending command
  const currentState = await getInstanceState(instanceId);
  
  if (!canPerformOperation(currentState.state, 'start')) {
    throw new Error(
      `Cannot start instance in state '${currentState.state}'. Instance must be stopped.`
    );
  }

  const client = createEC2Client();

  try {
    // Requirement 4.3: Retry logic for AWS transient errors
    await withRetry(async () => {
      const command = new StartInstancesCommand({
        InstanceIds: [instanceId],
      });
      await client.send(command);
    });

    logInfo('Started EC2 instance', { instanceId });
    
    // AWS APIは非同期なので、少し待ってから状態を確認
    // これにより、pending状態を確実に取得できる
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    // Requirement 8.5: Log error details server-side
    logError('Error starting EC2 instance', error, { instanceId });
    
    // Requirement 9.4: Return generic message to client
    if (error instanceof Error) {
      throw new Error(`Failed to start instance: ${error.message}`);
    }
    throw new Error('Failed to start instance');
  }
}

/**
 * Stop an EC2 instance
 * Requirement 5.1: Send stop command to AWS EC2 when state is 'running'
 * Requirement 5.4: Reject stop operation when state is 'pending'
 * Requirement 9.1: Use IAM credentials with limited permissions
 * Requirement 9.5: Verify target instance ID before executing command
 * 
 * @param instanceId - The EC2 instance ID to stop
 * @throws Error if instance is not in valid state or AWS API call fails
 */
export async function stopInstance(instanceId: string): Promise<void> {
  // Requirement 9.5: Validate instance ID before executing command
  validateInstanceId(instanceId);

  // Check current state before attempting to stop
  // Requirement 5.4: Validate state before sending command
  const currentState = await getInstanceState(instanceId);
  
  if (!canPerformOperation(currentState.state, 'stop')) {
    // Requirement 5.4: Special message for pending state
    if (currentState.state === 'pending') {
      throw new Error('Cannot stop instance while it is still starting');
    }
    throw new Error(
      `Cannot stop instance in state '${currentState.state}'. Instance must be running.`
    );
  }

  const client = createEC2Client();

  try {
    // Requirement 5.3: Retry logic for AWS transient errors
    await withRetry(async () => {
      const command = new StopInstancesCommand({
        InstanceIds: [instanceId],
      });
      await client.send(command);
    });

    logInfo('Stopped EC2 instance', { instanceId });
    
    // AWS APIは非同期なので、少し待ってから状態を確認
    // これにより、stopping状態を確実に取得できる
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    // Requirement 8.5: Log error details server-side
    logError('Error stopping EC2 instance', error, { instanceId });
    
    // Requirement 9.4: Return generic message to client
    if (error instanceof Error) {
      throw new Error(`Failed to stop instance: ${error.message}`);
    }
    throw new Error('Failed to stop instance');
  }
}
