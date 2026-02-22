'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // URLパラメータから認証コードとstateを取得
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // エラーチェック
        if (errorParam) {
          setError(`認証エラー: ${errorDescription || errorParam}`);
          setIsProcessing(false);
          return;
        }

        if (!code) {
          setError('認証コードが見つかりません');
          setIsProcessing(false);
          return;
        }

        // CSRF対策: stateの検証
        const savedState = sessionStorage.getItem('line_auth_state');
        let stateData: any = state;
        try {
          stateData = JSON.parse(state || '');
        } catch {
          // stateがJSONでない場合はそのまま使用
        }

        const actualState = typeof stateData === 'object' ? stateData.state : stateData;
        if (actualState !== savedState) {
          setError('不正なリクエストです（state不一致）');
          setIsProcessing(false);
          return;
        }

        // 招待コードを取得（新規ユーザーの場合）
        const invitationCode = sessionStorage.getItem('invitation_code');

        // バックエンドAPIを呼び出して認証を完了
        const response = await fetch('/api/auth/line/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            invitationCode: invitationCode || undefined,
          }),
        });

        // セッションストレージをクリア
        sessionStorage.removeItem('line_auth_state');
        sessionStorage.removeItem('invitation_code');

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error?.message || '認証に失敗しました');
          setIsProcessing(false);
          return;
        }

        // 認証成功 - ダッシュボードにリダイレクト
        router.push('/dashboard');
      } catch (err) {
        console.error('Authentication error:', err);
        setError('認証処理中にエラーが発生しました');
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">認証処理中...</h2>
            <p className="text-gray-600">しばらくお待ちください</p>
          </>
        ) : error ? (
          <>
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2 text-red-700">認証エラー</h2>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-md transition-colors"
            >
              ログインページに戻る
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}
