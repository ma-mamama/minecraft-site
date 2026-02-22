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

// Requirements 3.2, 3.3, 3.4, 3.5: サーバーステータス表示コンポーネント
function ServerStatusDisplay({
  ec2State,
  minecraftState,
  isLoading,
}: {
  ec2State: ServerState;
  minecraftState: MinecraftState | null;
  isLoading: boolean;
}) {
  const getEC2StatusConfig = (state: ServerState) => {
    switch (state) {
      case 'running':
        return {
          label: 'EC2稼働中',
          icon: '⚡',
          color: 'from-green-500 to-emerald-600',
          borderColor: 'border-green-500',
          glowColor: 'shadow-[0_0_30px_rgba(34,197,94,0.5)]',
          dotColor: 'bg-green-400',
        };
      case 'pending':
        return {
          label: 'EC2起動中',
          icon: '🚀',
          color: 'from-yellow-500 to-orange-500',
          borderColor: 'border-yellow-500',
          glowColor: 'shadow-[0_0_30px_rgba(234,179,8,0.5)]',
          dotColor: 'bg-yellow-400',
        };
      case 'stopped':
        return {
          label: 'EC2停止中',
          icon: '⏸️',
          color: 'from-gray-600 to-gray-700',
          borderColor: 'border-gray-600',
          glowColor: '',
          dotColor: 'bg-gray-500',
        };
      case 'stopping':
        return {
          label: 'EC2停止処理中',
          icon: '⏹️',
          color: 'from-orange-500 to-red-500',
          borderColor: 'border-orange-500',
          glowColor: 'shadow-[0_0_30px_rgba(249,115,22,0.5)]',
          dotColor: 'bg-orange-400',
        };
      default:
        return {
          label: 'EC2不明',
          icon: '❓',
          color: 'from-gray-500 to-gray-600',
          borderColor: 'border-gray-500',
          glowColor: '',
          dotColor: 'bg-gray-400',
        };
    }
  };

  const getMinecraftStatusConfig = (state: MinecraftState) => {
    switch (state) {
      case 'online':
        return {
          label: 'マイクラ起動中',
          icon: '🎮',
          color: 'from-blue-500 to-cyan-500',
          borderColor: 'border-blue-500',
          glowColor: 'shadow-[0_0_30px_rgba(59,130,246,0.5)]',
          dotColor: 'bg-blue-400',
          animate: false,
        };
      case 'starting':
        return {
          label: 'マイクラ起動準備中',
          icon: '⏳',
          color: 'from-purple-500 to-pink-500',
          borderColor: 'border-purple-500',
          glowColor: 'shadow-[0_0_30px_rgba(168,85,247,0.5)]',
          dotColor: 'bg-purple-400',
          animate: true,
        };
      case 'offline':
        return {
          label: 'マイクラ停止中',
          icon: '💤',
          color: 'from-gray-600 to-gray-700',
          borderColor: 'border-gray-600',
          glowColor: '',
          dotColor: 'bg-gray-500',
          animate: false,
        };
      default:
        return {
          label: 'マイクラ不明',
          icon: '❓',
          color: 'from-gray-500 to-gray-600',
          borderColor: 'border-gray-500',
          glowColor: '',
          dotColor: 'bg-gray-400',
          animate: false,
        };
    }
  };

  const ec2Config = getEC2StatusConfig(ec2State);
  const minecraftConfig = minecraftState ? getMinecraftStatusConfig(minecraftState) : null;

  return (
    <div className="space-y-4">
      {/* EC2 Status */}
      <div
        className={`gaming-card rounded-xl p-6 border-2 ${ec2Config.borderColor} ${ec2Config.glowColor} transition-all duration-300 relative overflow-hidden`}
      >
        {/* Animated background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-r ${ec2Config.color} opacity-10`}></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-5xl animate-float">{ec2Config.icon}</div>
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">EC2 Instance</p>
              <p className={`text-3xl font-bold bg-gradient-to-r ${ec2Config.color} bg-clip-text text-transparent mb-1`}>
                {ec2Config.label}
              </p>
              <p className="text-xs text-gray-500">
                {ec2State === 'running' && 'インスタンスは正常に稼働しています'}
                {ec2State === 'pending' && 'インスタンスを起動しています...'}
                {ec2State === 'stopped' && 'インスタンスは停止しています'}
                {ec2State === 'stopping' && 'インスタンスを停止しています...'}
                {ec2State === 'unknown' && 'ステータスを確認中...'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            {isLoading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-gray-600 border-t-[#00ff88]"></div>
            ) : (
              <div
                className={`w-6 h-6 rounded-full ${ec2Config.dotColor} ${
                  ec2State === 'pending' || ec2State === 'stopping' ? 'animate-glow-pulse' : ''
                }`}
              ></div>
            )}
          </div>
        </div>
      </div>

      {/* Minecraft Status */}
      {minecraftConfig && (
        <div
          className={`gaming-card rounded-xl p-6 border-2 ${minecraftConfig.borderColor} ${minecraftConfig.glowColor} transition-all duration-300 relative overflow-hidden`}
        >
          {/* Animated background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-r ${minecraftConfig.color} opacity-10`}></div>
          
          <div className="relative z-10 flex items-center space-x-4">
            <div className="text-5xl animate-float" style={{ animationDelay: '0.5s' }}>{minecraftConfig.icon}</div>
            <div className="flex-1">
              <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">Minecraft Server</p>
              <p className={`text-3xl font-bold bg-gradient-to-r ${minecraftConfig.color} bg-clip-text text-transparent mb-1`}>
                {minecraftConfig.label}
              </p>
              <p className="text-xs text-gray-500">
                {minecraftState === 'online' && 'サーバーは起動済みです。接続可能です'}
                {minecraftState === 'starting' && 'サーバーを起動しています。しばらくお待ちください'}
                {minecraftState === 'offline' && 'サーバーは停止しています'}
                {minecraftState === 'unknown' && 'サーバーの状態を確認中...'}
              </p>
            </div>
            <div
              className={`w-6 h-6 rounded-full ${minecraftConfig.dotColor} ${
                minecraftConfig.animate ? 'animate-glow-pulse' : ''
              }`}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Requirements 6.1, 6.2, 6.3: 招待コード生成コンポーネント
function InvitationCodeGenerator({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Requirement 6.1, 6.2, 6.3: 招待コード生成処理
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

  // コピー機能
  const handleCopy = async () => {
    if (!generatedCode) return;

    try {
      await navigator.clipboard.writeText(generatedCode);
      setIsCopied(true);
      toast.success('クリップボードにコピーしました');

      // 3秒後にコピー状態をリセット
      setTimeout(() => {
        setIsCopied(false);
      }, 3000);
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('コピーに失敗しました');
    }
  };

  // 有効期限の表示フォーマット
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
    <div className="space-y-4">
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className={`gaming-button w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 relative overflow-hidden ${
          isGenerating
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transform hover:scale-105 active:scale-95'
        }`}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
            <span>生成中...</span>
          </span>
        ) : (
          <span className="flex items-center justify-center space-x-2">
            <span>🎫</span>
            <span>招待コードを生成</span>
          </span>
        )}
      </button>

      {generatedCode && expiresAt && (
        <div className="gaming-card rounded-xl p-6 border-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)] animate-glow-pulse">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-3 uppercase tracking-wider flex items-center space-x-2">
                <span>✨</span>
                <span>生成された招待コード</span>
              </p>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-black bg-opacity-60 px-4 py-4 rounded-lg border border-[#00ff88] border-opacity-50 font-mono text-xl text-[#00ff88] tracking-wider">
                  {generatedCode}
                </code>
                <button
                  onClick={handleCopy}
                  className={`gaming-button px-6 py-4 rounded-lg font-bold transition-all duration-300 ${
                    isCopied
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]'
                      : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white'
                  }`}
                >
                  {isCopied ? '✓ コピー済み' : '📋 コピー'}
                </button>
              </div>
            </div>
            <div className="bg-black bg-opacity-40 rounded-lg p-4 border border-white border-opacity-10">
              <p className="text-sm text-gray-400 mb-1">⏰ 有効期限</p>
              <p className="text-lg font-bold text-[#00d4ff]">
                {formatExpiresAt(expiresAt)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (生成から5時間有効)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Requirements 4.1, 4.4, 4.5, 5.1, 5.4, 5.5: サーバー制御パネルコンポーネント
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
  // Requirements 4.5, 5.5: デバウンス処理（ダブルクリック防止）
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAction = (action: () => void) => {
    if (isDebouncing || isOperating) return;

    setIsDebouncing(true);
    action();

    // 2秒間のデバウンス
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

  // Requirements 4.4: 起動ボタンは停止中のみ有効
  const canStart = state === 'stopped' && !isOperating && !isDebouncing;
  // Requirements 5.1: 停止ボタンは稼働中のみ有効
  const canStop = state === 'running' && !isOperating && !isDebouncing;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => handleAction(onStart)}
          disabled={!canStart}
          className={`gaming-button py-6 px-8 rounded-xl font-bold text-xl transition-all duration-300 relative overflow-hidden ${
            canStart
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-emerald-600 hover:to-green-500 text-white shadow-lg hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] transform hover:scale-105 active:scale-95'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          <span className="relative z-10 flex items-center justify-center space-x-3">
            <span className="text-2xl">{state === 'pending' ? '🚀' : '▶️'}</span>
            <span>{state === 'pending' ? '起動中...' : 'サーバー起動'}</span>
          </span>
        </button>
        <button
          onClick={() => handleAction(onStop)}
          disabled={!canStop}
          className={`gaming-button py-6 px-8 rounded-xl font-bold text-xl transition-all duration-300 relative overflow-hidden ${
            canStop
              ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-rose-600 hover:to-red-500 text-white shadow-lg hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] transform hover:scale-105 active:scale-95'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          <span className="relative z-10 flex items-center justify-center space-x-3">
            <span className="text-2xl">{state === 'stopping' ? '⏹️' : '⏸️'}</span>
            <span>{state === 'stopping' ? '停止中...' : 'サーバー停止'}</span>
          </span>
        </button>
      </div>
      {(state === 'pending' || state === 'stopping') && (
        <div className="gaming-card rounded-xl p-6 border-2 border-[#00d4ff] shadow-[0_0_30px_rgba(0,212,255,0.3)]">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-[4px] border-gray-700 border-t-[#00d4ff]"></div>
              <div className="absolute inset-0 rounded-full bg-[#00d4ff] opacity-20 animate-ping"></div>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#00d4ff] mb-1">
                {state === 'pending' ? '🚀 サーバーを起動しています' : '⏹️ サーバーを停止しています'}
              </p>
              <p className="text-sm text-gray-400">
                処理が完了するまでしばらくお待ちください...
              </p>
            </div>
          </div>
        </div>
      )}
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

  // Requirements 3.1: サーバーステータスを取得
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
      // Requirement: ステータスポーリング失敗時の優雅な劣化
      // エラーをトーストで表示するが、アプリケーションは継続
      toast.error('サーバーステータスの取得に失敗しました');
      setServerState('unknown');
    } finally {
      setIsStatusLoading(false);
    }
  }, [router, toast]);

  // Requirements 4.1: サーバー起動処理
  const handleStart = async () => {
    try {
      setIsOperating(true);

      const response = await fetch('/api/server/start', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        // Requirements 4.4: 不正な状態での起動を防止
        throw new Error(data.error?.message || 'サーバーの起動に失敗しました');
      }

      setServerState(data.state);
      setMinecraftState('starting'); // 起動開始時はstartingに設定
      toast.success('サーバーの起動を開始しました');
      // 起動処理後、ステータスをポーリング
      startPolling();
    } catch (error) {
      console.error('Start error:', error);
      toast.error(error instanceof Error ? error.message : 'サーバーの起動に失敗しました');
    } finally {
      setIsOperating(false);
    }
  };

  // Requirements 5.1: サーバー停止処理
  const handleStop = async () => {
    try {
      setIsOperating(true);

      const response = await fetch('/api/server/stop', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        // Requirements 5.4: pending状態での停止を防止
        throw new Error(data.error?.message || 'サーバーの停止に失敗しました');
      }

      setServerState(data.state);
      setMinecraftState(null); // 停止中はMinecraft状態をリセット
      toast.success('サーバーの停止を開始しました');
      // 停止処理後、ステータスをポーリング
      startPolling();
    } catch (error) {
      console.error('Stop error:', error);
      toast.error(error instanceof Error ? error.message : 'サーバーの停止に失敗しました');
    } finally {
      setIsOperating(false);
    }
  };

  // Requirements: 遷移状態中は10秒ごとにポーリング
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchServerStatus();
    }, 10000);
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

  // 初回ステータス取得
  useEffect(() => {
    if (user) {
      fetchServerStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // fetchServerStatusを依存配列から削除

  // 遷移状態の監視とポーリング制御
  useEffect(() => {
    // EC2が遷移中、またはEC2は起動済みだがMinecraftがまだ起動中の場合はポーリング
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
      <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-[#00ff88] opacity-10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#00d4ff] opacity-10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        </div>
        <div className="flex flex-col items-center space-y-6 relative z-10">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-[5px] border-gray-700 border-t-[#00ff88]"></div>
            <div className="absolute inset-0 rounded-full bg-[#00ff88] opacity-20 animate-ping"></div>
          </div>
          <p className="text-xl text-gray-300 font-bold">読み込み中...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 relative overflow-hidden">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-[#00ff88] opacity-10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#00d4ff] opacity-10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-[#ff00ff] opacity-5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-5xl relative z-10">
        {/* Header */}
        <div className="gaming-card rounded-2xl p-6 mb-6 transition-all duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold neon-text text-[#00ff88] mb-1 flex items-center space-x-3">
                <span>⛏️</span>
                <span>Minecraft Server Control</span>
              </h1>
              <p className="text-gray-400 mt-2 text-lg">
                ようこそ、<span className="text-[#00d4ff] font-bold">{user?.displayName || 'ユーザー'}</span>さん
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="gaming-button bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              🚪 ログアウト
            </button>
          </div>
        </div>

        {/* Server Status */}
        <div className="gaming-card rounded-2xl p-6 mb-6 transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#00d4ff] flex items-center space-x-2">
              <span>📊</span>
              <span>サーバーステータス</span>
            </h2>
            <button
              onClick={fetchServerStatus}
              disabled={isStatusLoading}
              className={`gaming-button py-2 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center space-x-2 ${
                isStatusLoading
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transform hover:scale-105 active:scale-95'
              }`}
            >
              <span className={isStatusLoading ? 'animate-spin' : ''}>🔄</span>
              <span>{isStatusLoading ? '更新中...' : 'リロード'}</span>
            </button>
          </div>
          <ServerStatusDisplay
            ec2State={serverState}
            minecraftState={minecraftState}
            isLoading={isStatusLoading}
          />
        </div>

        {/* Server Control */}
        <div className="gaming-card rounded-2xl p-6 mb-6 transition-all duration-300">
          <h2 className="text-2xl font-bold mb-6 text-[#00ff88] flex items-center space-x-2">
            <span>🎮</span>
            <span>サーバー制御</span>
          </h2>
          <ServerControlPanel
            state={serverState}
            onStart={handleStart}
            onStop={handleStop}
            isOperating={isOperating}
          />
        </div>

        {/* Invitation Code Generator */}
        <div className="gaming-card rounded-2xl p-6 transition-all duration-300">
          <h2 className="text-2xl font-bold mb-4 text-purple-400 flex items-center space-x-2">
            <span>🎫</span>
            <span>招待コード生成</span>
          </h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            新しいユーザーを招待するためのコードを生成できます。コードは5時間有効です。
          </p>
          <InvitationCodeGenerator toast={toast} />
        </div>
      </div>
    </main>
  );
}
