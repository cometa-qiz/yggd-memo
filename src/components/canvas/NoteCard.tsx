'use client';

import { useState, useRef } from 'react';
import type { Note } from '@/types';

type Props = {
  note: Note;
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
};

const LONG_PRESS_MS = 500;

export function NoteCard({ note, onEdit, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startLongPress() {
    timerRef.current = setTimeout(() => {
      setDraft(note.text);
      setEditing(true);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
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
      style={{ position: 'absolute', left: note.x, top: note.y }}
      className="min-w-[120px] max-w-[200px]"
    >
      <div className="relative rounded-lg border border-gray-200 bg-white p-3 shadow-md">
        <button
          onClick={handleRemove}
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
          <p
            className="select-none whitespace-pre-wrap break-words text-sm"
            onPointerDown={startLongPress}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
          >
            {note.text}
          </p>
        )}
      </div>
    </div>
  );
}
