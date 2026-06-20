'use client';

import { useState, useEffect, useRef } from 'react';
import type { Note } from '@/types';

type Props = {
  note: Note;
  zoom?: number;
  cutMode?: boolean;
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
  onMove: (noteId: string, x: number, y: number) => Promise<void>;
  onConnectStart: (noteId: string) => void;
  onConnectEnter: (noteId: string) => void;
  onConnectLeave: (noteId: string) => void;
  isConnectTarget: boolean;
};

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD = 5;

export function NoteCard({
  note,
  zoom = 1,
  cutMode = false,
  onEdit,
  onRemove,
  onMove,
  onConnectStart,
  onConnectEnter,
  onConnectLeave,
  isConnectTarget,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [isDragging, setIsDragging] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // started: pointerdown がこのカード上で起きたかのフラグ
  // （接続モード中に pointermove がバブルしてきても誤ドラッグしないようにする）
  const dragRef = useRef({
    started: false,
    active: false,
    startPX: 0,
    startPY: 0,
    startX: 0,
    startY: 0,
  });

  useEffect(() => {
    if (!dragRef.current.active) {
      setPos({ x: note.x, y: note.y });
    }
  }, [note.x, note.y]);

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
    // started でない場合は接続モード中のバブルイベントなので無視
    if (editing || !dragRef.current.started) return;
    const dx = e.clientX - dragRef.current.startPX;
    const dy = e.clientY - dragRef.current.startPY;

    if (!dragRef.current.active && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      cancelLongPress();
      dragRef.current.active = true;
      setIsDragging(true);
    }

    if (dragRef.current.active) {
      // スクリーン座標の差分をノート座標系に変換（zoom > 1 のとき scale 分だけ補正）
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
      await onMove(note.id, finalX, finalY);
    }
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
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        cursor: cutMode ? 'default' : isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 10 : 1,
        touchAction: 'none',
        // 切るモード中はカードへの全ポインターイベントを無効化し、背後の線をクリック可能にする
        pointerEvents: cutMode ? 'none' : undefined,
      }}
      className="group min-w-[120px] max-w-[200px]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={() => onConnectEnter(note.id)}
      onPointerLeave={() => onConnectLeave(note.id)}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`relative rounded-lg border p-3 shadow-md bg-white transition-colors ${
          isConnectTarget
            ? 'border-blue-400 ring-2 ring-blue-200'
            : 'border-gray-200'
        }`}
      >
        <button
          onClick={handleRemove}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
          aria-label="メモを削除"
        >
          ✕
        </button>

        {/* つなぐハンドル：切るモード中は非表示、それ以外はホバー時のみ表示（右辺中央） */}
        {!cutMode && (
          <div
            className="absolute -right-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-slate-300 bg-white opacity-0 transition-opacity group-hover:opacity-100 hover:border-blue-400"
            onPointerDown={(e) => {
              e.stopPropagation();
              onConnectStart(note.id);
            }}
            aria-label="つなぐ"
          />
        )}

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
    </div>
  );
}
