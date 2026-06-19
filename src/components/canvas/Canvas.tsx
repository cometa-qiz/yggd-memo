'use client';

import type { Note } from '@/types';
import { NoteCard } from './NoteCard';

type Props = {
  notes: Note[];
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
};

export function Canvas({ notes, onEdit, onRemove }: Props) {
  return (
    <div className="relative flex-1 overflow-hidden bg-gray-50">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
