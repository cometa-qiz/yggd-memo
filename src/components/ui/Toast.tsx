'use client';

import { useBoardsContext } from '@/contexts/BoardsContext';
import { useToasts, type ToastItem } from '@/contexts/ToastContext';

/** 1件のトーストバブル */
function ToastBubble({ toast }: { toast: ToastItem }) {
  const isError = toast.type === 'error';
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        padding: '10px 18px',
        borderRadius: '999px',
        fontSize: '13px',
        lineHeight: '1.4',
        maxWidth: '340px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
        // エラーは固定赤（スキン非依存）、成功はスキンのチップ色
        background: isError ? '#dc2626' : 'var(--chip-bg)',
        color: isError ? '#ffffff' : 'var(--chip-fg)',
        // slide-in → 2.7s 表示 → slide-out（globals.css に定義）
        animation: 'toast-slide-in 0.3s ease, toast-slide-out 0.3s ease 2.7s forwards',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {isError ? '⚠ ' : '✓ '}
      {toast.message}
    </div>
  );
}

/**
 * 画面下部中央にトースト一覧を表示する。
 * - AppProviders 内（BoardsProvider・ToastProvider の子）に配置する。
 * - 現在のスキンクラスを適用することで --chip-bg / --chip-fg が正しく解決される。
 */
export function ToastContainer() {
  const toasts = useToasts();
  const { currentBoard } = useBoardsContext();
  const skin = currentBoard?.skin ?? 'leaf';

  if (toasts.length === 0) return null;

  return (
    <div
      // スキン CSS 変数を継承させるためスキンクラスを付与する
      className={`skin-${skin}`}
      style={{
        position: 'fixed',
        bottom: '80px',  // モバイルのナビ領域・CanvasControls と重ならない位置
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column-reverse',  // 新しいトーストが下に積まれる
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastBubble key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
