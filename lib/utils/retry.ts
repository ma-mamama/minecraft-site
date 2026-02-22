/**
 * リトライロジックユーティリティ
 * Requirement 3.6, 4.3, 5.3: AWS/Supabaseの一時的なエラーに対するリトライロジック
 */

import { logWarn, logError } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  shouldRetry: isTransientError,
};

/**
 * 一時的なエラーかどうかを判定
 */
function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const transientPatterns = [
    'timeout',
    'econnreset',
    'econnrefused',
    'network',
    'temporary',
    'throttl',
    'rate limit',
    'too many requests',
    'service unavailable',
    '503',
    '429',
  ];

  return transientPatterns.some(pattern => message.includes(pattern));
}

/**
 * 指数バックオフでリトライを実行
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // 最後の試行の場合、またはリトライすべきでないエラーの場合は即座に失敗
      if (attempt === opts.maxAttempts || !opts.shouldRetry(error)) {
        if (attempt < opts.maxAttempts) {
          logError('Non-retryable error encountered', error, { attempt });
        }
        throw error;
      }

      // リトライ可能なエラーの場合は警告をログに記録
      logWarn('Retrying after transient error', {
        attempt,
        maxAttempts: opts.maxAttempts,
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error),
      });

      // 指数バックオフで待機
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  // この行には到達しないはずだが、TypeScriptのために必要
  throw lastError;
}

/**
 * 指定されたミリ秒待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
