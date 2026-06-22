'use client';

import { useState, useRef } from 'react';
import { useBoardsContext } from '@/contexts/BoardsContext';
import type { Board } from '@/types';

export function BoardManager() {
  const { boards, currentBoard, addBoard, renameBoard, removeBoard, switchBoard } = useBoardsContext();

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
      <h2
        className="text-sm font-semibold uppercase tracking-wide"
        style={{ color: 'var(--ink-soft)' }}
      >
        ボード一覧・管理
      </h2>

      {/* ボード一覧 */}
      <ul
        className="divide-y rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--line)', borderColor: 'var(--line)' }}
      >
        {boards.map((board) => (
          <li
            key={board.id}
            className="flex items-center gap-2 px-4 py-3"
            style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
          >
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
                  className="flex-1 min-w-0 text-sm rounded-lg px-3 py-1 focus:outline-none"
                  style={{
                    background: 'var(--field)',
                    color: 'var(--ink)',
                    border: '1px solid var(--dusk)',
                  }}
                  aria-label="ボード名を入力"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitRename(board);
                  }}
                  className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70"
                  style={{ color: 'var(--ink)' }}
                >
                  確定
                </button>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    cancelRename();
                  }}
                  className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  取消
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => switchBoard(board.id)}
                  className="flex-1 min-w-0 text-left text-sm truncate"
                  style={{ color: 'var(--ink)' }}
                >
                  {board.name}
                </button>
                {currentBoard?.id === board.id && (
                  <span className="text-xs shrink-0" style={{ color: 'var(--ink-soft)' }}>
                    表示中
                  </span>
                )}
                <button
                  onClick={() => startRename(board)}
                  className="shrink-0 text-xs px-2 py-1 rounded transition-opacity hover:opacity-70"
                  style={{ color: 'var(--ink-soft)' }}
                  aria-label={`${board.name} の名前を変更`}
                >
                  名前変更
                </button>
                <button
                  onClick={() => removeBoard(board.id)}
                  disabled={boards.length <= 1}
                  className="shrink-0 text-xs px-2 py-1 rounded transition-opacity hover:opacity-70 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: 'var(--dusk)' }}
                  aria-label={`${board.name} を削除`}
                >
                  削除
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
          className="flex-1 min-w-0 text-sm rounded-xl px-3 py-2 focus:outline-none"
          style={{
            background: 'var(--paper)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
          }}
          aria-label="新しいボード名を入力"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim() || adding}
          className="shrink-0 text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'var(--dusk)', color: '#fff' }}
        >
          追加
        </button>
      </div>
    </section>
  );
}
