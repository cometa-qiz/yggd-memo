'use client';

import { useBoardsContext } from '@/contexts/BoardsContext';
import { useNotes } from '@/hooks/useNotes';
import { NoteInput } from '@/components/layout/NoteInput';
import { Canvas } from '@/components/canvas/Canvas';

export default function Home() {
  const { currentBoard } = useBoardsContext();
  const { notes, addNote, editNote, removeNote } = useNotes(currentBoard?.id ?? null);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <NoteInput addNote={addNote} />
      <Canvas notes={notes} onEdit={editNote} onRemove={removeNote} />
    </div>
  );
}
