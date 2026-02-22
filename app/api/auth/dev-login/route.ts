/**
 * Development Mode Login API
 * Creates a session for a test user without LINE authentication
 * WARNING: Only works when DEV_MODE_SKIP_AUTH=true and NODE_ENV !== production
 */

import { NextResponse } from 'next/server';
import { createDevSession, getSessionCookieOptions, isDevModeEnabled } from '@/lib/services/auth';
import { logInfo, logWarn } from '@/lib/utils/logger';

export async function POST() {
  console.log('[DEV-LOGIN] POST request received');
  console.log('[DEV-LOGIN] Environment check:', {
    DEV_MODE_SKIP_AUTH: process.env.DEV_MODE_SKIP_AUTH,
    NODE_ENV: process.env.NODE_ENV,
  });
  
  try {
    // Check if dev mode is enabled
    const devModeEnabled = isDevModeEnabled();
    console.log('[DEV-LOGIN] Dev mode enabled:', devModeEnabled);
    
    if (!devModeEnabled) {
      logWarn('Dev mode login attempted but dev mode is not enabled');
      return NextResponse.json(
        { error: '開発モードが有効になっていません' },
        { status: 403 }
      );
    }

    logInfo('Creating dev mode session');
    console.log('[DEV-LOGIN] Creating dev session...');

    // Create session for test user
    const session = await createDevSession();
    console.log('[DEV-LOGIN] Session created:', session.id);

    // Set session cookie
    const cookieOptions = getSessionCookieOptions();
    console.log('[DEV-LOGIN] Cookie options:', cookieOptions);
    
    const response = NextResponse.json({ success: true });
    response.cookies.set('session', session.id, cookieOptions);

    logInfo('Dev mode session created successfully', { sessionId: session.id });
    console.log('[DEV-LOGIN] Response sent with cookie');

    return response;
  } catch (error) {
    console.error('[DEV-LOGIN] Error:', error);
    if (error instanceof Error) {
      console.error('[DEV-LOGIN] Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'ログインに失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
