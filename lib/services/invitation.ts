/**
 * Invitation Code Service
 * Handles invitation code generation, validation, and consumption
 * Requirements: 1.2, 1.3, 6.1, 6.4, 6.5
 */

import { supabaseServer } from '../supabase/server';
import { InvitationCode, InvitationCodeRow, InvitationCodeInsert } from '../types/database';
import { randomBytes } from 'crypto';
import { withRetry } from '@/lib/utils/retry';
import { logError, logInfo } from '@/lib/utils/logger';

/**
 * Invitation code validation result
 */
export interface InvitationCodeValidation {
  valid: boolean;
  reason?: 'not_found' | 'expired' | 'already_used';
}

/**
 * Convert database row to InvitationCode object
 */
function rowToInvitationCode(row: InvitationCodeRow): InvitationCode {
  return {
    id: row.id,
    code: row.code,
    created_at: new Date(row.created_at),
    expires_at: new Date(row.expires_at),
    used_at: row.used_at ? new Date(row.used_at) : null,
    used_by_user_id: row.used_by_user_id,
    is_used: row.is_used,
  };
}

/**
 * Generate a unique random invitation code
 * Requirement 6.1: Generate unique random code
 * 
 * @returns InvitationCode object with 5-hour expiration
 * @throws Error if code generation fails
 */
export async function generateInvitationCode(): Promise<InvitationCode> {
  try {
    // Generate cryptographically random 16-character code
    // Using 12 bytes which gives us 16 characters in base64url encoding
    const code = randomBytes(12).toString('base64url');

    // Set expiration to 5 hours from now
    // Requirement 6.3: Set expiration time to 5 hours from creation
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 5);

    const codeInsert: InvitationCodeInsert = {
      code,
      expires_at: expiresAt.toISOString(),
    };

    // Requirement 6.2: Store with creation timestamp and unused status
    // Retry logic for transient database errors
    const data = await withRetry(async () => {
      const { data, error } = await supabaseServer
        .from('invitation_codes')
        .insert(codeInsert)
        .select()
        .single();

      if (error || !data) {
        throw new Error('Failed to generate invitation code');
      }

      return data;
    });

    logInfo('Invitation code generated', { code });

    return rowToInvitationCode(data);
  } catch (error) {
    logError('Error generating invitation code', error);
    throw error;
  }
}

/**
 * Validate an invitation code
 * Requirement 1.2: Reject already used codes
 * Requirement 1.3: Reject expired codes (>5 hours old)
 * Requirement 6.5: Validate both expiration time and usage status
 * 
 * @param code - The invitation code to validate
 * @returns InvitationCodeValidation object indicating validity and reason if invalid
 */
export async function validateInvitationCode(
  code: string
): Promise<InvitationCodeValidation> {
  try {
    const { data, error } = await supabaseServer
      .from('invitation_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      return { valid: false, reason: 'not_found' };
    }

    const invitationCode = rowToInvitationCode(data);

    // Check expiration first (fail fast)
    // Requirement 1.3: Reject codes older than 5 hours
    if (invitationCode.expires_at < new Date()) {
      return { valid: false, reason: 'expired' };
    }

    // Check if already used
    // Requirement 1.2: Reject already used codes
    if (invitationCode.is_used) {
      return { valid: false, reason: 'already_used' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating invitation code:', error);
    return { valid: false, reason: 'not_found' };
  }
}

/**
 * Consume an invitation code (mark as used and link to user)
 * Requirement 6.4: Mark code as used and prevent further use
 * 
 * @param code - The invitation code to consume
 * @param userId - The user ID to link the code to
 * @throws Error if code consumption fails or code is invalid
 */
export async function consumeInvitationCode(
  code: string,
  userId: string
): Promise<void> {
  try {
    // First validate the code
    const validation = await validateInvitationCode(code);
    if (!validation.valid) {
      throw new Error(`Invalid invitation code: ${validation.reason}`);
    }

    // Mark as used and link to user
    // Requirement 6.4: Mark as used and prevent further use
    const { error } = await supabaseServer
      .from('invitation_codes')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        used_by_user_id: userId,
      })
      .eq('code', code);

    if (error) {
      throw new Error('Failed to consume invitation code');
    }
  } catch (error) {
    console.error('Error consuming invitation code:', error);
    throw error;
  }
}

/**
 * Clean up expired invitation codes
 * Removes codes that have expired and were never used
 * 
 * @returns Number of codes deleted
 */
export async function cleanupExpiredCodes(): Promise<number> {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabaseServer
      .from('invitation_codes')
      .delete()
      .lt('expires_at', now)
      .eq('is_used', false)
      .select();

    if (error) {
      throw new Error('Failed to cleanup expired codes');
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Error cleaning up expired codes:', error);
    throw error;
  }
}
