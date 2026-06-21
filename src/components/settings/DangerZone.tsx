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
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
        危険な操作
      </h2>

      <div className="border border-red-100 rounded-xl overflow-hidden divide-y divide-red-50">
        {/* メモの一括削除 */}
        <div className="px-4 py-4 bg-white space-y-2">
          <p className="text-sm font-medium text-zinc-800">
            このボードのメモを全て削除
          </p>
          <p className="text-xs text-zinc-400">
            「{currentBoard?.name ?? 'このボード'}」のメモとつながりをすべて非表示にします。
            この操作は取り消せません。
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="mt-1 text-sm px-4 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            メモを全て削除
          </button>
        </div>

        {/* サインアウト */}
        <div className="px-4 py-4 bg-white space-y-2">
          <p className="text-sm font-medium text-zinc-800">
            サインアウト
          </p>
          <p className="text-xs text-zinc-400">
            アカウントからサインアウトします。
          </p>
          <button
            onClick={() => signOut()}
            className="mt-1 text-sm px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            サインアウト
          </button>
        </div>
      </div>

      {/* 確認ポップアップ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-base font-semibold text-zinc-800">
              メモを全て削除しますか？
            </h3>
            <p className="text-sm text-zinc-500">
              「{currentBoard?.name}」のメモとつながりをすべて非表示にします。
              この操作は取り消せません。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition-colors"
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
