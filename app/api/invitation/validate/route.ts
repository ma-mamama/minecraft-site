/**
 * Invitation Code Validation API Route
 * Check invitation code validity
 * Requirements: 6.4, 6.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateInvitationCode } from '@/lib/services/invitation';
import { sanitizeString } from '@/lib/utils/sanitize';

// Input validation schema
const validateSchema = z.object({
  code: z.string().min(1, 'Invitation code is required'),
});

/**
 * POST /api/invitation/validate
 * Check if an invitation code is valid
 * Requirement 6.4: Check if code is used
 * Requirement 6.5: Validate both expiration time and usage status
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = validateSchema.safeParse(body);

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

    const { code } = validation.data;

    // Requirement 8.4: Sanitize input
    const sanitizedCode = sanitizeString(code);

    // Validate invitation code
    const result = await validateInvitationCode(sanitizedCode);

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          reason: result.reason,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error validating invitation code:', error);

    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Failed to validate invitation code',
        },
      },
      { status: 500 }
    );
  }
}
