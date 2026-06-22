'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'error' | 'success';

export type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** トーストが DOM に残る時間（ms）。アニメーションの合計より少し長め */
const TOAST_DURATION = 3200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast }}>
      {children}
    </ToastContext.Provider>
  );
}

/** エラー・成功をトーストで表示する関数を返すフック */
export function useToast(): (message: string, type?: ToastType) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast: ToastProvider が見つかりません');
  return ctx.showToast;
}

/** ToastContainer 専用: toasts リストを返すフック */
export function useToasts(): ToastItem[] {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts: ToastProvider が見つかりません');
  return ctx.toasts;
}
