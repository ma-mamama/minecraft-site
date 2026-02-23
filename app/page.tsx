'use client';

import { useState, useEffect } from 'react';

export default function LoginPage() {
  const [invitationCode, setInvitationCode] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    fetch('/api/auth/dev-mode-check')
      .then(res => res.json())
      .then(data => setIsDevMode(data.enabled))
      .catch(() => setIsDevMode(false));
  }, []);

  const handleLineLogin = () => {
    setError('');
    setIsLoading(true);

    const lineChannelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
    const callbackUrl = process.env.NEXT_PUBLIC_LINE_CALLBACK_URL || `${window.location.origin}/auth/callback`;
    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);

    const stateData = isNewUser && invitationCode 
      ? JSON.stringify({ state, invitationCode })
      : state;

    sessionStorage.setItem('line_auth_state', state);
    if (isNewUser && invitationCode) {
      sessionStorage.setItem('invitation_code', invitationCode);
    }

    const authUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', lineChannelId || '');
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', stateData);
    authUrl.searchParams.set('scope', 'profile openid');
    authUrl.searchParams.set('nonce', nonce);

    window.location.href = authUrl.toString();
  };

  const handleDevLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'ログインに失敗しました');
      }

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isNewUser && !invitationCode.trim()) {
      setError('招待コードを入力してください');
      return;
    }

    handleLineLogin();
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Decorative floating accents */}
      <div className="pointer-events-none absolute -top-8 left-6 w-24 h-24 rounded-xl opacity-30 blur-xl bg-emerald-500/30 animate-float-slow" />
      <div className="pointer-events-none absolute bottom-10 -right-6 w-28 h-28 rounded-full opacity-25 blur-xl bg-blue-500/25 animate-float-slow" style={{ animationDelay: '1.2s' }} />
      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 -left-10 w-16 h-16 rotate-12 opacity-20 blur-lg" style={{ background: 'conic-gradient(from 180deg at 50% 50%, rgba(16,185,129,0.35), rgba(59,130,246,0.28), transparent 70%)' }} />
      {/* Pixel sparks */}
      <div className="pixel-spark run" style={{ left: '18%', bottom: '18%', animationDelay: '0s' }} />
      <div className="pixel-spark blue run" style={{ right: '14%', top: '22%', animationDelay: '.6s' }} />
      <div className="pixel-spark yellow run" style={{ left: '8%', top: '30%', animationDelay: '1.2s' }} />

      {/* Card: 360px width on mobile, centered */}
      <div className="w-full max-w-[380px] animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="aurora-border">
          <div className="aurora-inner card card-accent">
            {/* Padding: 24px (p-6) */}
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
                  {error}
                </div>
              )}

              {/* Title: 20px bold */}
              <div className="flex items-center gap-2.5 justify-center">
                <h1 className="text-[20px] font-bold leading-tight text-[#E5E7EB] hdr-game text-center">
                  Minecraft Server Control
                </h1>
              </div>
              
              {/* Subtitle: 14px, 32px from title (8px margin) */}
              <p className="text-[14px] text-[#A7B0BB] mt-2 text-center">
                LINEで認証してサーバーを操作できます
              </p>

              <form onSubmit={handleSubmit} className="mt-[28px]">
                {/* Checkbox: 20x20, 60px from subtitle */}
                <label className="flex items-start cursor-pointer animate-fade-up" style={{ animationDelay: '120ms' }}>
                  <div className="relative flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isNewUser}
                      onChange={(e) => setIsNewUser(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-[#384758] bg-transparent appearance-none checked:bg-[#10B981] checked:border-[#10B981] cursor-pointer transition-transform duration-150"
                    />
                    {isNewUser && (
                      <svg className="absolute top-0.5 left-0.5 w-4 h-4 text-[#0B0F14] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="ml-2 text-[14px] text-[#A7B0BB] leading-5">
                    初めて利用する（招待コードが必要です）
                  </span>
                </label>

                {/* Invitation code input: appears 52px below checkbox */}
                {isNewUser && (
                <div className="mt-[37px] animate-fade-up" style={{ animationDelay: '180ms' }}>
                  {/* Label: 14px semibold */}
                  <label htmlFor="invitationCode" className="block text-[14px] font-semibold text-[#E5E7EB] mb-3">
                    招待コード
                  </label>
                  {/* Input: 312px width, 44px height */}
                  <input
                    type="text"
                    id="invitationCode"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value)}
                    placeholder="招待コードを入力"
                    className="w-full h-11 px-3 rounded bg-[#0D131A] border border-[#1C2430] text-[#E5E7EB] text-[14px] placeholder:text-[#A7B0BB] focus:outline-none focus:border-[#10B981] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                    disabled={isLoading}
                  />
                </div>
                )}

                {/* LINE login button: 312px width, 48px height, 184px from label (or 60px from checkbox if no code) */}
              <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 mt-[60px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors tappable btn-pill btn-focus-ring btn-shine animate-fade-up bg-[#10B981] hover:bg-[#059669]"
                  style={{ animationDelay: isNewUser ? '240ms' : '180ms' }}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="hourglass" />
                      <span className="text-[16px] font-bold text-[#0B0F14]">処理中...</span>
                    </div>
                  ) : (
                  <span className="text-[16px] font-bold text-[#0B0F14]">LINE でログイン</span>
                  )}
                </button>

                {/* Dev mode button: 312px width, 44px height, 58px from LINE button */}
                {isDevMode && (
                <button
                    type="button"
                    onClick={handleDevLogin}
                    disabled={isLoading}
                    className="w-full h-11 mt-[10px] bg-[#121924] hover:bg-[#1A2332] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors tappable btn-pill animate-fade-up"
                    style={{ animationDelay: isNewUser ? '300ms' : '220ms' }}
                  >
                  <span className="text-[14px] font-semibold text-[#A7B0BB]">
                    {isLoading ? '処理中...' : '開発モードでログイン'}
                  </span>
                </button>
                )}
              </form>

              {/* Note: 12px, 78px from dev button (or 136px from LINE button if no dev) */}
              <p className="mt-[34px] text-[12px] text-[#A7B0BB] animate-fade-up text-center" style={{ animationDelay: isNewUser ? '360ms' : '260ms' }}>
                このシステムは招待制です
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
