/**
 * Development Mode Check API
 * Returns whether dev mode authentication skip is enabled
 */

import { NextResponse } from 'next/server';
import { isDevModeEnabled } from '@/lib/services/auth';

export async function GET() {
  return NextResponse.json({
    enabled: isDevModeEnabled(),
  });
}
