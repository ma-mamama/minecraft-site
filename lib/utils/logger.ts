/**
 * サーバーサイドロギングユーティリティ
 * Requirement 8.5: エラー詳細をサーバーサイドでログに記録し、クライアントには汎用的なエラーメッセージを返す
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  operation?: string;
  instanceId?: string;
  [key: string]: unknown;
}

/**
 * コンテキスト付きでエラーをログに記録
 */
export function logError(
  message: string,
  error: unknown,
  context?: LogContext
): void {
  const timestamp = new Date().toISOString();
  const errorDetails = error instanceof Error ? {
    message: error.message,
    stack: error.stack,
    name: error.name,
  } : { error };

  console.error(JSON.stringify({
    timestamp,
    level: 'error',
    message,
    error: errorDetails,
    context: context || {},
  }));
}

/**
 * コンテキスト付きで警告をログに記録
 */
export function logWarn(
  message: string,
  context?: LogContext
): void {
  const timestamp = new Date().toISOString();
  
  console.warn(JSON.stringify({
    timestamp,
    level: 'warn',
    message,
    context: context || {},
  }));
}

/**
 * コンテキスト付きで情報をログに記録
 */
export function logInfo(
  message: string,
  context?: LogContext
): void {
  const timestamp = new Date().toISOString();
  
  console.log(JSON.stringify({
    timestamp,
    level: 'info',
    message,
    context: context || {},
  }));
}
