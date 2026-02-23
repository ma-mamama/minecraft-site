'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/hooks/useToast';
import { ToastContainer } from '@/app/components/Toast';

interface User {
  id: string;
  lineSub: string;
  displayName: string | null;
}

type ServerState = 'running' | 'stopped' | 'pending' | 'stopping' | 'unknown';
type MinecraftState = 'online' | 'offline' | 'starting' | 'unknown';

interface ServerStatus {
  ec2: {
    state: ServerState;
    timestamp: string;
  };
  minecraft: {
    state: MinecraftState;
    timestamp: string;
  } | null;
}

// サーバーステータス表示コンポーネント
function ServerStatusDisplay({
  ec2State,
  minecraftState,
  isLoading,
  onRefresh,
}: {
  ec2State: ServerState;
  minecraftState: MinecraftState | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const getEC2StatusConfig = (state: ServerState) => {
    switch (state) {
      case 'running':
        return {
          label: 'EC2稼働中',
          desc: 'インスタンスは正常に稼働しています',
          dotClass: 'status-dot-emerald',
          animate: false,
        };
      case 'pending':
        return {
          label: 'EC2起動中',
          desc: 'インスタンスを起動しています...',
          dotClass: 'status-dot-yellow',
          animate: true,
        };
      case 'stopped':
        return {
          label: 'EC2停止中',
          desc: 'インスタンスは停止しています',
          dotClass: 'status-dot-gray',
          animate: false,
        };
      case 'stopping':
        return {
          label: 'EC2停止処理中',
          desc: 'インスタンスを停止しています...',
          dotClass: 'status-dot-red',
          animate: true,
        };
      default:
        return {
          label: 'EC2不明',
          desc: 'ステータスを確認中...',
          dotClass: 'status-dot-gray',
          animate: false,
        };
    }
  };

  const getMinecraftStatusConfig = (state: MinecraftState) => {
    switch (state) {
      case 'online':
        return {
          label: 'マイクラ起動中',
          desc: 'サーバーは起動済みです。接続可能です',
          dotClass: 'status-dot-emerald',
          animate: false,
        };
      case 'starting':
        return {
          label: 'マイクラ起動準備中',
          desc: 'サーバーを起動しています。しばらくお待ちください',
          dotClass: 'status-dot-yellow',
          animate: true,
        };
      case 'offline':
        return {
          label: 'マイクラ停止中',
          desc: 'サーバーは停止しています',
          dotClass: 'status-dot-gray',
          animate: false,
        };
      default:
        return {
          label: 'マイクラ不明',
          desc: 'サーバーの状態を確認中...',
          dotClass: 'status-dot-gray',
          animate: false,
        };
    }
  };

  const ec2Config = getEC2StatusConfig(ec2State);
  const minecraftConfig = minecraftState ? getMinecraftStatusConfig(minecraftState) : null;

  return (
    <div className="card card-accent card-hover">
      <div className="p-4">
        <div className="flex items-center justify-between mb-6 lg:mb-8">
          <h2 className="text-base font-bold text-[#E5E7EB] hdr-game">サーバーステータス</h2>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="icon-btn"
            aria-label="ステータスを更新"
            title="更新"
          >
            {/* Refresh icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12a9 9 0 10-3.34 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="space-y-4 lg:space-y-[28px]">
          {/* EC2 Status */}
          <div className="flex items-start space-x-2">
            <div className={`status-dot ${ec2Config.dotClass} mt-1.5 ${ec2Config.animate ? 'animate-pulse-dot' : ''}`}></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#E5E7EB]">
                {ec2Config.label}
              </p>
              <p className="text-[13px] text-[#A7B0BB] mt-1.5">
                {ec2Config.desc}
              </p>
            </div>
          </div>

          {/* Minecraft Status */}
          {minecraftConfig && (
            <div className="flex items-start space-x-2">
              <div className={`status-dot ${minecraftConfig.dotClass} mt-1.5 ${minecraftConfig.animate ? 'animate-pulse-dot' : ''}`}></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#E5E7EB]">
                  {minecraftConfig.label}
                </p>
                <p className="text-[13px] text-[#A7B0BB] mt-1.5">
                  {minecraftConfig.desc}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// サーバー制御パネルコンポーネント
function ServerControlPanel({
  state,
  onStart,
  onStop,
  isOperating,
}: {
  state: ServerState;
  onStart: () => void;
  onStop: () => void;
  isOperating: boolean;
}) {
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAction = (action: () => void) => {
    if (isDebouncing || isOperating) return;

    setIsDebouncing(true);
    action();

    debounceTimerRef.current = setTimeout(() => {
      setIsDebouncing(false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const canStart = state === 'stopped' && !isOperating && !isDebouncing;
  const canStop = state === 'running' && !isOperating && !isDebouncing;

  return (
    <div className="card card-accent card-hover">
      <div className="p-4">
        <h2 className="text-base font-bold text-[#E5E7EB] mb-4 hdr-game">
          サーバー制御
        </h2>

        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
          <button
            onClick={() => handleAction(onStart)}
            disabled={!canStart}
            className="btn-emerald btn-pill btn-elevate btn-focus-ring h-12 lg:h-12 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex-1 tappable flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5v14l11-7-11-7z" fill="#0B0F14"/>
            </svg>
            {state === 'pending' ? '起動中...' : 'サーバー起動'}
          </button>
          <button
            onClick={() => handleAction(onStop)}
            disabled={!canStop}
            className="btn-red btn-pill btn-elevate btn-focus-ring h-12 lg:h-12 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex-1 tappable flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="7" y="7" width="10" height="10" fill="#0B0F14" rx="1"/>
            </svg>
            {state === 'stopping' ? '停止中...' : 'サーバー停止'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 招待コード生成コンポーネント
function InvitationCodeGenerator({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setIsCopied(false);

      const response = await fetch('/api/invitation/generate', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || '招待コードの生成に失敗しました');
      }

      const data = await response.json();
      setGeneratedCode(data.code);
      setExpiresAt(data.expiresAt);
      toast.success('招待コードを生成しました');
    } catch (error) {
      console.error('Generate invitation code error:', error);
      toast.error(error instanceof Error ? error.message : '招待コードの生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;

    try {
      await navigator.clipboard.writeText(generatedCode);
      setIsCopied(true);
      toast.success('クリップボードにコピーしました');

      setTimeout(() => {
        setIsCopied(false);
      }, 3000);
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('コピーに失敗しました');
    }
  };

  const formatExpiresAt = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="card card-accent card-hover">
      <div className="p-4">
        <h2 className="text-base font-bold text-[#E5E7EB] mb-3">
          招待コード生成
        </h2>
        <p className="text-[13px] text-[#A7B0BB] mb-4">
          新しいユーザーを招待するためのコードを生成できます。コードは5時間有効です。
        </p>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="btn-emerald btn-pill btn-elevate btn-focus-ring h-12 lg:h-10 px-5 text-sm font-bold mb-4 disabled:opacity-50 disabled:cursor-not-allowed tappable-sm flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12h14M12 5v14" stroke="#0B0F14" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {isGenerating ? '生成中...' : '招待コードを生成'}
        </button>

        {generatedCode && expiresAt && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#E5E7EB]">
              生成された招待コード
            </p>
            <div className="flex items-center gap-2">
              <div className="input flex-1 px-3 py-2.5 rounded font-mono text-base">
                {generatedCode}
              </div>
              <button
                onClick={handleCopy}
                className="btn-emerald btn-pill btn-elevate btn-focus-ring h-12 lg:h-10 px-5 text-sm font-bold whitespace-nowrap tappable-sm flex items-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="9" y="9" width="10" height="10" rx="2" stroke="#0B0F14" strokeWidth="2"/>
                  <rect x="5" y="5" width="10" height="10" rx="2" fill="#0B0F14" opacity=".25"/>
                </svg>
                {isCopied ? 'コピー済み' : 'コピー'}
              </button>
            </div>
            <p className="text-xs text-[#A7B0BB]">
              有効期限: {formatExpiresAt(expiresAt)} （生成から5時間有効）
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverState, setServerState] = useState<ServerState>('unknown');
  const [minecraftState, setMinecraftState] = useState<MinecraftState | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchServerStatus = useCallback(async () => {
    try {
      setIsStatusLoading(true);
      const response = await fetch('/api/server/status');

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/');
          return;
        }
        const data = await response.json();
        throw new Error(data.error?.message || 'ステータスの取得に失敗しました');
      }

      const data: ServerStatus = await response.json();
      setServerState(data.ec2.state);
      setMinecraftState(data.minecraft?.state || null);
    } catch (error) {
      console.error('Status fetch error:', error);
      toast.error('サーバーステータスの取得に失敗しました');
      setServerState('unknown');
    } finally {
      setIsStatusLoading(false);
    }
  }, [router, toast]);

  const handleStart = async () => {
    try {
      setIsOperating(true);

      const response = await fetch('/api/server/start', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'サーバーの起動に失敗しました');
      }

      setServerState(data.state);
      setMinecraftState('starting');
      toast.success('サーバーの起動を開始しました');
      startPolling();
    } catch (error) {
      console.error('Start error:', error);
      toast.error(error instanceof Error ? error.message : 'サーバーの起動に失敗しました');
    } finally {
      setIsOperating(false);
    }
  };

  const handleStop = async () => {
    try {
      setIsOperating(true);

      const response = await fetch('/api/server/stop', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'サーバーの停止に失敗しました');
      }

      setServerState(data.state);
      setMinecraftState(null);
      toast.success('サーバーの停止を開始しました');
      startPolling();
    } catch (error) {
      console.error('Stop error:', error);
      toast.error(error instanceof Error ? error.message : 'サーバーの停止に失敗しました');
    } finally {
      setIsOperating(false);
    }
  };

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchServerStatus();
    }, 15000); // 15秒ごとにポーリング
  }, [fetchServerStatus]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session');

        if (!response.ok) {
          router.push('/');
          return;
        }

        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error('Session check error:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchServerStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // fetchServerStatusを依存配列から削除

  useEffect(() => {
    const shouldPoll = 
      serverState === 'pending' || 
      serverState === 'stopping' ||
      (serverState === 'running' && minecraftState === 'starting');
    
    if (shouldPoll) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [serverState, minecraftState, startPolling, stopPolling]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="hourglass hourglass-lg" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      
      {/* Header */}
      <header className="card border-b-2 border-b-[#065F46] card-hover">
        <div className="px-4 lg:px-6 h-20 lg:h-[86px] flex items-center justify-between">
          <div>
            <h1 className="text-base lg:text-xl font-bold text-[#E5E7EB] hdr-game">
              Minecraft Server Control
            </h1>
            <p className="text-sm text-[#A7B0BB] mt-1 lg:hidden">
              ようこそ、{user?.displayName || 'ユーザー'}さん
            </p>
          </div>
          <p className="text-sm text-[#A7B0BB] hidden lg:block">
            ようこそ、{user?.displayName || 'ユーザー'}さん
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 lg:px-[180px] pt-7 lg:pt-[34px]">
        <div className="grid grid-cols-1 lg:grid-cols-[720px_336px] gap-4 lg:gap-6">
          {/* Left Column */}
          <div className="space-y-4 lg:space-y-[24px]">
            <ServerStatusDisplay
              ec2State={serverState}
              minecraftState={minecraftState}
              isLoading={isStatusLoading}
              onRefresh={fetchServerStatus}
            />
            <ServerControlPanel
              state={serverState}
              onStart={handleStart}
              onStop={handleStop}
              isOperating={isOperating}
            />
          </div>

          {/* Right Column */}
          <div>
            <InvitationCodeGenerator toast={toast} />
          </div>
        </div>
      </main>
    </>
  );
}
