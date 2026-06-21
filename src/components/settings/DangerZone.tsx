'use client';

import { useBoardsContext } from '@/contexts/BoardsContext';

type Props = {
  /** 「メモを全て削除」ボタンが押されたときのハンドラ（設定画面から渡す） */
  onDeleteAllNotes: () => void;
  /** 「サインアウト」ボタンが押されたときのハンドラ（設定画面から渡す） */
  onSignOut: () => void;
};

export function DangerZone({ onDeleteAllNotes, onSignOut }: Props) {
  const { currentBoard } = useBoardsContext();

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
            onClick={onDeleteAllNotes}
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
            onClick={onSignOut}
            className="mt-1 text-sm px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            サインアウト
          </button>
        </div>
      </div>
    </section>
  );
}
