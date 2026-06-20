'use client';

import type { Note } from '@/types';
import { NoteCard } from './NoteCard';

type Props = {
  notes: Note[];
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
  onMove: (noteId: string, x: number, y: number) => Promise<void>;
};

export function Canvas({ notes, onEdit, onRemove, onMove }: Props) {
  return (
    <div className="relative flex-1 overflow-hidden bg-gray-50">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onEdit={onEdit}
          onRemove={onRemove}
          onMove={onMove}
        />
      ))}
    </div>
  );
}
