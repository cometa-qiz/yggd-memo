'use client';

import { useState, useEffect, useRef } from 'react';
import type { Note } from '@/types';

type Props = {
  note: Note;
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
  onMove: (noteId: string, x: number, y: number) => Promise<void>;
};

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD = 5;

export function NoteCard({ note, onEdit, onRemove, onMove }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [isDragging, setIsDragging] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({ active: false, startPX: 0, startPY: 0, startX: 0, startY: 0 });

  // Firestoreからの更新をドラッグ中以外に反映する
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
    dragRef.current = { active: false, startPX: e.clientX, startPY: e.clientY, startX: pos.x, startY: pos.y };

    timerRef.current = setTimeout(() => {
      if (!dragRef.current.active) {
        setDraft(note.text);
        setEditing(true);
      }
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (editing) return;
    const dx = e.clientX - dragRef.current.startPX;
    const dy = e.clientY - dragRef.current.startPY;

    if (!dragRef.current.active && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      cancelLongPress();
      dragRef.current.active = true;
      setIsDragging(true);
    }

    if (dragRef.current.active) {
      setPos({ x: dragRef.current.startX + dx, y: dragRef.current.startY + dy });
    }
  }

  async function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    cancelLongPress();
    if (dragRef.current.active) {
      const finalX = dragRef.current.startX + (e.clientX - dragRef.current.startPX);
      const finalY = dragRef.current.startY + (e.clientY - dragRef.current.startPY);
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
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 10 : 1,
        touchAction: 'none',
      }}
      className="min-w-[120px] max-w-[200px]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="relative rounded-lg border border-gray-200 bg-white p-3 shadow-md">
        <button
          onClick={handleRemove}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
          aria-label="メモを削除"
        >
          ✕
        </button>

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
