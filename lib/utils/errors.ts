/**
 * エラーハンドリングユーティリティ
 * Requirement 8.5: 内部詳細を公開しないユーザーフレンドリーなエラーメッセージ
 */

export type ErrorCode =
  | 'AUTH_FAILED'
  | 'SESSION_EXPIRED'
  | 'ACCESS_DENIED'
  | 'INVALID_INPUT'
  | 'INVALID_STATE'
  | 'OPERATION_IN_PROGRESS'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

export interface AppError {
  code: ErrorCode;
  message: string;
  statusCode: number;
}

/**
 * アプリケーションエラークラス
 */
export class ApplicationError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

/**
 * エラーコードに対応する日本語メッセージを取得
 */
export function getErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    AUTH_FAILED: '認証に失敗しました',
    SESSION_EXPIRED: 'セッションの有効期限が切れました。再度ログインしてください',
    ACCESS_DENIED: 'アクセスが拒否されました。招待コードを使用して登録してください',
    INVALID_INPUT: '入力内容が正しくありません',
    INVALID_STATE: '現在の状態ではこの操作を実行できません',
    OPERATION_IN_PROGRESS: '別の操作が進行中です。しばらくお待ちください',
    SERVICE_UNAVAILABLE: 'サービスが一時的に利用できません。しばらくしてから再度お試しください',
    UNKNOWN_ERROR: '予期しないエラーが発生しました',
  };

  return messages[code] || messages.UNKNOWN_ERROR;
}

/**
 * エラーをAppErrorに変換
 */
export function toAppError(error: unknown): AppError {
  // ApplicationErrorの場合はそのまま返す
  if (error instanceof ApplicationError) {
    return {
      code: error.code,
      message: getErrorMessage(error.code),
      statusCode: error.statusCode,
    };
  }

  // 一般的なErrorの場合はメッセージから推測
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('token') || message.includes('authentication')) {
      return {
        code: 'AUTH_FAILED',
        message: getErrorMessage('AUTH_FAILED'),
        statusCode: 401,
      };
    }

    if (message.includes('session') || message.includes('expired')) {
      return {
        code: 'SESSION_EXPIRED',
        message: getErrorMessage('SESSION_EXPIRED'),
        statusCode: 401,
      };
    }

    if (message.includes('whitelist') || message.includes('access denied')) {
      return {
        code: 'ACCESS_DENIED',
        message: getErrorMessage('ACCESS_DENIED'),
        statusCode: 403,
      };
    }

    if (message.includes('state') || message.includes('cannot')) {
      return {
        code: 'INVALID_STATE',
        message: getErrorMessage('INVALID_STATE'),
        statusCode: 400,
      };
    }

    if (message.includes('lock') || message.includes('in progress')) {
      return {
        code: 'OPERATION_IN_PROGRESS',
        message: getErrorMessage('OPERATION_IN_PROGRESS'),
        statusCode: 409,
      };
    }

    if (
      message.includes('unavailable') ||
      message.includes('timeout') ||
      message.includes('network')
    ) {
      return {
        code: 'SERVICE_UNAVAILABLE',
        message: getErrorMessage('SERVICE_UNAVAILABLE'),
        statusCode: 503,
      };
    }
  }

  // デフォルトは不明なエラー
  return {
    code: 'UNKNOWN_ERROR',
    message: getErrorMessage('UNKNOWN_ERROR'),
    statusCode: 500,
  };
}

/**
 * エラーレスポンスを作成
 */
export function createErrorResponse(error: unknown): Response {
  const appError = toAppError(error);
  
  return Response.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
      },
    },
    { status: appError.statusCode }
  );
}
