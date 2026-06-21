'use client';

import { useState, useEffect, useRef, forwardRef } from 'react';
import type { Note, BoardSkin } from '@/types';

// スキンごとのカード配色（ロゴ色と対応: 葉=緑 / デフォルト=グレー / 雲=水色）
const SKIN_CARD: Record<BoardSkin, { bg: string; border: string }> = {
  leaf:    { bg: 'bg-green-50', border: 'border-green-200' },
  default: { bg: 'bg-white',    border: 'border-zinc-300'  },
  cloud:   { bg: 'bg-sky-100',  border: 'border-sky-300'   },
};

type Props = {
  note: Note;
  skin?: BoardSkin;
  zoom?: number;
  cutMode?: boolean;
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
  onMove: (noteId: string, x: number, y: number) => Promise<void>;
  onConnectStart: (noteId: string) => void;
  onConnectEnter: (noteId: string) => void;
  onConnectLeave: (noteId: string) => void;
  isConnectTarget: boolean;
  /** clip-path アニメーション開始を親（Canvas）に通知するコールバック */
  onExpandChange?: (noteId: string) => void;
};

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD = 5;

export const NoteCard = forwardRef<HTMLDivElement, Props>(function NoteCard({
  note,
  skin = 'leaf',
  zoom = 1,
  cutMode = false,
  onEdit,
  onRemove,
  onMove,
  onConnectStart,
  onConnectEnter,
  onConnectLeave,
  isConnectTarget,
  onExpandChange,
}, ref) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [isDragging, setIsDragging] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({
    started: false,
    active: false,
    startPX: 0,
    startPY: 0,
    startX: 0,
    startY: 0,
  });
  const preventClickRef = useRef(false);

  // コールバックを ref に保持して stale closure を避ける
  const onExpandChangeRef = useRef(onExpandChange);
  useEffect(() => { onExpandChangeRef.current = onExpandChange; });

  useEffect(() => {
    if (!dragRef.current.active) {
      setPos({ x: note.x, y: note.y });
    }
  }, [note.x, note.y]);

  // skin と展開状態からクリップパスクラスを決定する
  // collapsed 時: leaf→clip-leaf / cloud→clip-cloud / default→clip-rounded-rect（変形なし）
  const collapsedClass = skin === 'cloud' ? 'clip-cloud' : skin === 'default' ? 'clip-rounded-rect' : 'clip-leaf';
  const clipClass = editing || expanded ? 'clip-rounded-rect' : collapsedClass;
  const prevClipClassRef = useRef(clipClass);
  useEffect(() => {
    if (clipClass !== prevClipClassRef.current) {
      prevClipClassRef.current = clipClass;
      onExpandChangeRef.current?.(note.id);
    }
  });

  function cancelLongPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (editing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      started: true,
      active: false,
      startPX: e.clientX,
      startPY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };

    timerRef.current = setTimeout(() => {
      if (!dragRef.current.active) {
        setDraft(note.text);
        setEditing(true);
      }
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (editing || !dragRef.current.started) return;
    const dx = e.clientX - dragRef.current.startPX;
    const dy = e.clientY - dragRef.current.startPY;

    if (!dragRef.current.active && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      cancelLongPress();
      dragRef.current.active = true;
      setIsDragging(true);
    }

    if (dragRef.current.active) {
      setPos({ x: dragRef.current.startX + dx / zoom, y: dragRef.current.startY + dy / zoom });
    }
  }

  async function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    cancelLongPress();
    if (!dragRef.current.started) return;
    dragRef.current.started = false;

    if (dragRef.current.active) {
      const finalX = dragRef.current.startX + (e.clientX - dragRef.current.startPX) / zoom;
      const finalY = dragRef.current.startY + (e.clientY - dragRef.current.startPY) / zoom;
      dragRef.current.active = false;
      setIsDragging(false);
      setPos({ x: finalX, y: finalY });
      preventClickRef.current = true;
      await onMove(note.id, finalX, finalY);
    }
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (preventClickRef.current) {
      preventClickRef.current = false;
      return;
    }
    if (editing) return;
    setExpanded((prev) => !prev);
  }

  async function handleSave() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.text) {
      await onEdit(note.id, trimmed);
    }
    setEditing(false);
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    await onRemove(note.id);
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        cursor: cutMode ? 'default' : isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 10 : 1,
        touchAction: 'none',
        pointerEvents: cutMode ? 'none' : undefined,
      }}
      className="group min-w-[120px] max-w-[200px]"
      data-note-card="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={() => onConnectEnter(note.id)}
      onPointerLeave={() => onConnectLeave(note.id)}
      onClick={handleClick}
    >
      {/*
       * カード本体: clipClass で葉↔角丸四角をアニメーション。
       * 削除ボタン・接続ハンドルはこの要素の外（兄弟要素）に置き、
       * clip-path によって切り抜かれないようにする。
       */}
      <div
        className={`${clipClass} relative border p-3 shadow-md ${SKIN_CARD[skin].bg} ${
          isConnectTarget
            ? 'border-blue-400 ring-2 ring-blue-200'
            : SKIN_CARD[skin].border
        }`}
      >
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            autoFocus
            rows={3}
            className="w-full resize-none text-sm focus:outline-none"
          />
        ) : (
          <p className="select-none whitespace-pre-wrap break-words text-sm">
            {note.text}
          </p>
        )}
      </div>

      {/* 削除ボタン: clip-path の外側（外側 div の直接子）に配置 */}
      <button
        onClick={(e) => { e.stopPropagation(); handleRemove(e); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
        aria-label="メモを削除"
      >
        ✕
      </button>

      {/* 接続ハンドル: clip-path の外側（外側 div の直接子）に配置 */}
      {!cutMode && (
        <div
          className="connect-handle absolute -right-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-slate-300 bg-white opacity-0 transition-opacity group-hover:opacity-100 hover:border-blue-400"
          onPointerDown={(e) => {
            e.stopPropagation();
            onConnectStart(note.id);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="つなぐ"
        />
      )}
    </div>
  );
});
