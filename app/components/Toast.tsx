'use client';

/**
 * トースト通知コンポーネント
 * ユーザーフィードバック用の通知UI
 */

import { useEffect } from 'react';
import type { Toast as ToastType } from '@/lib/hooks/useToast';

interface ToastProps {
  toast: ToastType;
  onClose: (id: string) => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onClose(toast.id);
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onClose]);

  const bgColor = {
    success: 'from-emerald-400 to-emerald-500',
    error: 'from-red-400 to-red-500',
    info: 'from-blue-400 to-blue-500',
    warning: 'from-yellow-400 to-yellow-500',
  }[toast.type];

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }[toast.type];

  return (
    <div
      className={`bg-gradient-to-br ${bgColor} text-white px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 min-w-[280px] max-w-[520px] animate-slide-in backdrop-blur-md`}
      role="alert"
    >
      <span className="text-lg font-bold drop-shadow-sm">{icon}</span>
      <p className="flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="text-white/90 hover:text-white font-bold text-lg px-1"
        aria-label="閉じる"
      >
        ×
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastType[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
