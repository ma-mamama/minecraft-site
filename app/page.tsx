'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [invitationCode, setInvitationCode] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLineLogin = () => {
    setError('');
    setIsLoading(true);

    // LINE認証のパラメータを構築
    const lineChannelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
    const callbackUrl = process.env.NEXT_PUBLIC_LINE_CALLBACK_URL || `${window.location.origin}/auth/callback`;
    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);

    // 招待コードがある場合はstateに含める
    const stateData = isNewUser && invitationCode 
      ? JSON.stringify({ state, invitationCode })
      : state;

    // stateをsessionStorageに保存（CSRF対策）
    sessionStorage.setItem('line_auth_state', state);
    if (isNewUser && invitationCode) {
      sessionStorage.setItem('invitation_code', invitationCode);
    }

    // LINE認証エンドポイントにリダイレクト
    const authUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', lineChannelId || '');
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', stateData);
    authUrl.searchParams.set('scope', 'profile openid');
    authUrl.searchParams.set('nonce', nonce);

    window.location.href = authUrl.toString();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 新規ユーザーの場合、招待コードの検証
    if (isNewUser && !invitationCode.trim()) {
      setError('招待コードを入力してください');
      return;
    }

    handleLineLogin();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-[#00ff88] opacity-10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#00d4ff] opacity-10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-[#ff00ff] opacity-5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md gaming-card rounded-2xl p-8 relative z-10 transition-all duration-300">
        {/* Scan line effect */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00ff88] to-transparent opacity-5 h-32 animate-scan-line"></div>
        </div>

        {/* Minecraft-style pixel corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00ff88]"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00ff88]"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00ff88]"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00ff88]"></div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-center mb-2 neon-text text-[#00ff88]">
            ⛏️ Minecraft Server
          </h1>
          <p className="text-xl font-bold text-center mb-2 text-[#00d4ff]">
            Control Panel
          </p>
          <p className="text-gray-400 text-center mb-8 text-sm">
            サーバーを管理するにはログインしてください
          </p>

          {error && (
            <div className="mb-4 p-3 bg-[#ff3366] bg-opacity-20 border border-[#ff3366] text-[#ff3366] rounded-lg backdrop-blur-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center space-x-3 mb-4 p-3 bg-white bg-opacity-5 rounded-lg border border-white border-opacity-10">
              <input
                type="checkbox"
                id="isNewUser"
                checked={isNewUser}
                onChange={(e) => setIsNewUser(e.target.checked)}
                className="w-5 h-5 accent-[#00ff88] rounded"
              />
              <label htmlFor="isNewUser" className="text-sm text-gray-300 flex-1">
                初めて利用する（招待コードが必要です）
              </label>
            </div>

            {isNewUser && (
              <div className="space-y-2">
                <label htmlFor="invitationCode" className="block text-sm font-medium text-[#00ff88] mb-2">
                  🎫 招待コード
                </label>
                <input
                  type="text"
                  id="invitationCode"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  placeholder="招待コードを入力"
                  className="w-full px-4 py-3 bg-black bg-opacity-40 border border-[#00ff88] border-opacity-30 rounded-lg focus:outline-none focus:border-[#00ff88] focus:border-opacity-100 text-white placeholder-gray-500 transition-all duration-300"
                  disabled={isLoading}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="gaming-button w-full bg-gradient-to-r from-[#00ff88] to-[#00d4ff] hover:from-[#00d4ff] hover:to-[#00ff88] disabled:from-gray-600 disabled:to-gray-700 text-black disabled:text-gray-400 font-bold py-4 px-6 rounded-lg transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-[0_0_30px_rgba(0,255,136,0.5)] disabled:shadow-none transform hover:scale-105 active:scale-95"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div>
                  <span>処理中...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                  <span className="text-lg">LINEでログイン</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-white bg-opacity-5 rounded-lg border border-white border-opacity-10">
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              🔒 このシステムは招待制です<br />
              初めての方は招待コードを入力してログインしてください
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
