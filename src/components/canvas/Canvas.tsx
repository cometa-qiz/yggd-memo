'use client';

import type { Note, Link } from '@/types';
import { NoteCard } from './NoteCard';
import { LinkLine } from './LinkLine';

// NoteCard の top-left 基準でカード中心を推定するオフセット
// max-w-[200px] の半分 / 推定カード高さの半分
const CARD_CX = 100;
const CARD_CY = 40;

type Props = {
  notes: Note[];
  links: Link[];
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
  onMove: (noteId: string, x: number, y: number) => Promise<void>;
};

export function Canvas({ notes, links, onEdit, onRemove, onMove }: Props) {
  const notesById = new Map(notes.map((n) => [n.id, n]));

  return (
    <div className="relative flex-1 overflow-hidden bg-gray-50">
      {/* SVG をカードより後ろに描画し、線がカードの下に来るようにする */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        overflow="visible"
      >
        {links.map((link) => {
          const a = notesById.get(link.a);
          const b = notesById.get(link.b);
          if (!a || !b) return null;
          return (
            <LinkLine
              key={link.id}
              x1={a.x + CARD_CX}
              y1={a.y + CARD_CY}
              x2={b.x + CARD_CX}
              y2={b.y + CARD_CY}
            />
          );
        })}
      </svg>
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
