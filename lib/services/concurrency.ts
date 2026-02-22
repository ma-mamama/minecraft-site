/**
 * Concurrency Control Service
 * Handles operation locking to prevent concurrent EC2 operations
 * Requirements: 4.5, 5.5, 10.1, 10.2, 10.3
 */

import { supabaseServer } from '../supabase/server';
import { OperationLockInsert } from '../types/database';
import { logError, logInfo, logWarn } from '@/lib/utils/logger';

/**
 * Acquire a lock for EC2 operations
 * Requirement 10.1, 10.2: Ensure only one operation is processed at a time
 * Requirement 10.3: Reject new operations while another is in progress
 * 
 * @param operationType - The type of operation ('start' or 'stop')
 * @returns Lock ID if acquired, null if lock already held
 */
export async function acquireOperationLock(
  operationType: 'start' | 'stop'
): Promise<string | null> {
  try {
    const lockId = `ec2-operation-${Date.now()}`;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // Lock expires after 5 minutes

    // Try to insert a lock record
    // This will fail if a non-expired lock already exists due to unique constraint
    const lockInsert: OperationLockInsert = {
      lock_id: lockId,
      operation_type: operationType,
      expires_at: expiresAt.toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('operation_locks')
      .insert(lockInsert)
      .select()
      .single();

    if (error) {
      // Check if there's an existing non-expired lock
      const { data: existingLock } = await supabaseServer
        .from('operation_locks')
        .select('*')
        .eq('operation_type', operationType)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (existingLock) {
        logWarn('Operation lock already held', { operationType });
        return null; // Lock already held
      }

      // If no existing lock, the error might be something else
      logError('Error acquiring lock', error, { operationType });
      return null;
    }

    logInfo('Operation lock acquired', { lockId, operationType });
    return lockId;
  } catch (error) {
    logError('Error in acquireOperationLock', error, { operationType });
    return null;
  }
}

/**
 * Release a lock for EC2 operations
 * Requirement 10.4: Release locks when operation completes
 * 
 * @param lockId - The lock ID to release
 */
export async function releaseOperationLock(lockId: string): Promise<void> {
  try {
    await supabaseServer
      .from('operation_locks')
      .delete()
      .eq('lock_id', lockId);
    
    logInfo('Operation lock released', { lockId });
  } catch (error) {
    logError('Error releasing lock', error, { lockId });
  }
}

/**
 * Clean up expired locks
 * Removes locks that have expired to prevent deadlocks
 */
export async function cleanupExpiredLocks(): Promise<void> {
  try {
    const { error } = await supabaseServer
      .from('operation_locks')
      .delete()
      .lt('expires_at', new Date().toISOString());
    
    if (error) {
      logError('Error cleaning up expired locks', error);
    }
  } catch (error) {
    logError('Error cleaning up expired locks', error);
  }
}
