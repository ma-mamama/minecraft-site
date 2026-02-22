/**
 * Tests for Invitation Code Validation API Route
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as invitation from '@/lib/services/invitation';

// Mock dependencies
vi.mock('@/lib/services/invitation', () => ({
  validateInvitationCode: vi.fn(),
}));

describe('POST /api/invitation/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when code is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/invitation/validate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('should return valid: true when code is valid', async () => {
    // Mock validateInvitationCode to return valid
    vi.mocked(invitation.validateInvitationCode).mockResolvedValue({
      valid: true,
    });

    const request = new NextRequest('http://localhost:3000/api/invitation/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'ABC123DEF456' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.reason).toBeUndefined();
    expect(invitation.validateInvitationCode).toHaveBeenCalledWith('ABC123DEF456');
  });

  it('should return valid: false with reason when code is not found', async () => {
    // Mock validateInvitationCode to return invalid
    vi.mocked(invitation.validateInvitationCode).mockResolvedValue({
      valid: false,
      reason: 'not_found',
    });

    const request = new NextRequest('http://localhost:3000/api/invitation/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'INVALID123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.reason).toBe('not_found');
  });

  it('should return valid: false with reason when code is expired', async () => {
    // Mock validateInvitationCode to return expired
    vi.mocked(invitation.validateInvitationCode).mockResolvedValue({
      valid: false,
      reason: 'expired',
    });

    const request = new NextRequest('http://localhost:3000/api/invitation/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'EXPIRED123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.reason).toBe('expired');
  });

  it('should return valid: false with reason when code is already used', async () => {
    // Mock validateInvitationCode to return already used
    vi.mocked(invitation.validateInvitationCode).mockResolvedValue({
      valid: false,
      reason: 'already_used',
    });

    const request = new NextRequest('http://localhost:3000/api/invitation/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'USED123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.reason).toBe('already_used');
  });

  it('should return 500 when validation fails with error', async () => {
    // Mock validateInvitationCode to throw error
    vi.mocked(invitation.validateInvitationCode).mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost:3000/api/invitation/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'ABC123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('VALIDATION_FAILED');
  });
});
