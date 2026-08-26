'use client';

import { useRef, useState } from 'react';
import { useBoardsContext } from '@/contexts/BoardsContext';
import type { Board } from '@/types';

const DRAG_THRESHOLD_PX = 8;

// Ref で同期的に管理するドラッグ状態（リスト画面の階層ドラッグ実装と同方式）
type DragRef = {
  boardId: string;
  startX: number;
  startY: number;
  active: boolean; // 閾値を超えて視覚ドラッグが始まったか
};

export function BoardManager() {
  const { boards, currentBoard, addBoard, renameBoard, removeBoard, switchBoard, reorderBoards } =
    useBoardsContext();

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState<Board | null>(null);
  const [deleting, setDeleting] = useState(false);

  const newInputRef = useRef<HTMLInputElement>(null);

  // 並び替えドラッグ用の状態（Pointer Events方式。HTML5 DnD APIは使用しない）
  const dragRef = useRef<DragRef | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  async function handleConfirmDelete() {
    if (!confirmDeleteBoard || deleting) return;
    setDeleting(true);
    try {
      await removeBoard(confirmDeleteBoard.id);
    } finally {
      setDeleting(false);
      setConfirmDeleteBoard(null);
    }
  }

  function handleDragHandlePointerDown(e: React.PointerEvent, boardId: string) {
    dragRef.current = {
      boardId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
  }

  function handleDragPointerMove(e: React.PointerEvent) {
    const dr = dragRef.current;
    if (!dr) return;

    if (!dr.active) {
      const dx = e.clientX - dr.startX;
      const dy = e.clientY - dr.startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      dr.active = true;
      setDraggingId(dr.boardId);
    }

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = (el as Element | null)?.closest('[data-board-id]') as HTMLElement | null;
    setDragOverId(target?.dataset?.boardId ?? null);
  }

  function clearDrag() {
    dragRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }

  function handleDragPointerUp(e: React.PointerEvent) {
    const dr = dragRef.current;
    if (!dr) return;

    if (!dr.active) {
      // 閾値未満のタップ → ドラッグとして扱わない
      dragRef.current = null;
      return;
    }

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = (el as Element | null)?.closest('[data-board-id]') as HTMLElement | null;
    const targetId = target?.dataset?.boardId ?? null;

    // clearDrag を先に呼んでから非同期処理へ
    const { boardId: draggedId } = dr;
    clearDrag();

    if (targetId) void executeReorder(draggedId, targetId);
  }

  async function executeReorder(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;

    const ids = boards.map((b) => b.id);
    const fromIndex = ids.indexOf(draggedId);
    if (fromIndex === -1) return;
    ids.splice(fromIndex, 1);

    // ドラッグ元を除いた並びの中で、ドロップ先のあった位置に挿入する
    const toIndex = ids.indexOf(targetId);
    if (toIndex === -1) return;
    ids.splice(toIndex, 0, draggedId);

    await reorderBoards(ids);
  }

  return (
    <>
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
            data-board-id={board.id}
            className="flex items-center gap-2 px-4 py-3 transition-colors"
            style={{
              background:
                dragOverId === board.id && draggingId !== board.id
                  ? 'rgba(var(--accent-rgb), 0.12)'
                  : 'var(--paper)',
              borderColor: 'var(--line)',
              opacity: draggingId === board.id ? 0.4 : 1,
              outline:
                dragOverId === board.id && draggingId !== board.id
                  ? '1px solid rgba(var(--accent-rgb), 0.4)'
                  : 'none',
            }}
          >
            {/* 並び替え用ドラッグハンドル */}
            <span
              onPointerDown={(e) => {
                e.stopPropagation();
                // 即座にキャプチャ → 以降のmove/upを確実にこの要素で受け取る
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                handleDragHandlePointerDown(e, board.id);
              }}
              onPointerMove={handleDragPointerMove}
              onPointerUp={handleDragPointerUp}
              onPointerCancel={clearDrag}
              className="shrink-0 select-none text-sm leading-none"
              style={{
                color: 'var(--ink-soft)',
                // タッチデバイスでブラウザのスクロール処理をキャンセルし、ドラッグを優先させる
                touchAction: 'none',
                cursor: draggingId === board.id ? 'grabbing' : 'grab',
              }}
              aria-label={`${board.name} をドラッグして並び替え`}
              role="button"
            >
              ⠿
            </span>

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
                  onClick={() => setConfirmDeleteBoard(board)}
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

    {/* ボード削除 確認ポップアップ */}
    {confirmDeleteBoard && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          className="rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4"
          style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
        >
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            このボードを削除しますか？
          </h3>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            「{confirmDeleteBoard.name}」を削除します。
            この操作は取り消せません。
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmDeleteBoard(null)}
              disabled={deleting}
              className="text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ border: '1px solid var(--line)', color: 'var(--ink)', background: 'transparent' }}
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirmDelete}
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
    </>
  );
}
