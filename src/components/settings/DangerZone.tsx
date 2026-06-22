'use client';

import { useState } from 'react';
import { useBoardsContext } from '@/contexts/BoardsContext';
import { useAuth } from '@/hooks/useAuth';
import { deactivateAllNotesAndLinks } from '@/lib/firestore';

export function DangerZone() {
  const { currentBoard } = useBoardsContext();
  const { user, signOut } = useAuth();

  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAll() {
    if (!user || !currentBoard) return;
    setDeleting(true);
    try {
      await deactivateAllNotesAndLinks(user.uid, currentBoard.id);
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2
        className="text-sm font-semibold uppercase tracking-wide"
        style={{ color: 'var(--ink-soft)' }}
      >
        危険な操作
      </h2>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(var(--accent-rgb), 0.25)' }}>
        {/* メモの一括削除 */}
        <div
          className="px-4 py-4 space-y-2"
          style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            このボードのメモを全て削除
          </p>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            「{currentBoard?.name ?? 'このボード'}」のメモとつながりをすべて非表示にします。
            この操作は取り消せません。
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="mt-1 text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{
              border: '1px solid var(--dusk)',
              color: 'var(--dusk)',
              background: 'transparent',
            }}
          >
            メモを全て削除
          </button>
        </div>

        {/* サインアウト */}
        <div
          className="px-4 py-4 space-y-2"
          style={{ background: 'var(--paper)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            サインアウト
          </p>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            アカウントからサインアウトします。
          </p>
          <button
            onClick={() => signOut()}
            className="mt-1 text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              background: 'transparent',
            }}
          >
            サインアウト
          </button>
        </div>
      </div>

      {/* 確認ポップアップ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4"
            style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
          >
            <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
              メモを全て削除しますか？
            </h3>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              「{currentBoard?.name}」のメモとつながりをすべて非表示にします。
              この操作は取り消せません。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ border: '1px solid var(--line)', color: 'var(--ink)', background: 'transparent' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--dusk)', color: '#fff' }}
              >
                {deleting ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
