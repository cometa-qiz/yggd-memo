'use client';

import { useState, useRef } from 'react';
import { useBoardsContext } from '@/contexts/BoardsContext';
import type { Board } from '@/types';

export function BoardManager() {
  const { boards, currentBoard, addBoard, renameBoard, switchBoard } = useBoardsContext();

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const newInputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await addBoard(trimmed);
      setNewName('');
    } finally {
      setAdding(false);
    }
  }

  function startRename(board: Board) {
    setRenamingId(board.id);
    setRenameValue(board.name);
  }

  async function commitRename(board: Board) {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== board.name) {
      await renameBoard(board.id, trimmed);
    }
    setRenamingId(null);
  }

  function cancelRename() {
    setRenamingId(null);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
        ボード一覧・管理
      </h2>

      {/* ボード一覧 */}
      <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
        {boards.map((board) => (
          <li key={board.id} className="flex items-center gap-2 px-4 py-3 bg-white">
            {renamingId === board.id ? (
              <>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(board)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(board);
                    if (e.key === 'Escape') cancelRename();
                  }}
                  className="flex-1 min-w-0 text-sm border border-zinc-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  aria-label="ボード名を入力"
                />
                <button
                  onMouseDown={(e) => {
                    // blur より先に commitRename を確定させる
                    e.preventDefault();
                    commitRename(board);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1 rounded transition-colors"
                >
                  確定
                </button>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    cancelRename();
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1 rounded transition-colors"
                >
                  取消
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => switchBoard(board.id)}
                  className="flex-1 min-w-0 text-left text-sm text-zinc-800 truncate"
                >
                  {board.name}
                </button>
                {currentBoard?.id === board.id && (
                  <span className="text-xs text-zinc-400 shrink-0">表示中</span>
                )}
                <button
                  onClick={() => startRename(board)}
                  className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1 rounded transition-colors"
                  aria-label={`${board.name} の名前を変更`}
                >
                  名前変更
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* 新規ボード作成 */}
      <div className="flex gap-2">
        <input
          ref={newInputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="新しいボード名"
          className="flex-1 min-w-0 text-sm border border-zinc-200 rounded-xl px-3 py-2 placeholder:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-300"
          aria-label="新しいボード名を入力"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim() || adding}
          className="shrink-0 text-sm px-4 py-2 rounded-xl bg-zinc-800 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
        >
          追加
        </button>
      </div>
    </section>
  );
}
