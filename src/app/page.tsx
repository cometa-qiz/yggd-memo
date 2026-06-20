'use client';

import { useBoardsContext } from '@/contexts/BoardsContext';
import { useNotes } from '@/hooks/useNotes';
import { useLinks } from '@/hooks/useLinks';
import { NoteInput } from '@/components/layout/NoteInput';
import { Canvas } from '@/components/canvas/Canvas';
import { findEmptyPosition } from '@/utils/positionUtils';

const DEFAULT_X = 20;
const DEFAULT_Y = 20;

export default function Home() {
  const { currentBoard, loading: boardLoading } = useBoardsContext();
  const { notes, addNote, editNote, removeNote, moveNote } = useNotes(currentBoard?.id ?? null);
  const { links, addLink, removeLink } = useLinks(currentBoard?.id ?? null);

  async function handleAddNote(text: string, _x: number, _y: number): Promise<string> {
    const { x, y } = findEmptyPosition(DEFAULT_X, DEFAULT_Y, notes);
    return addNote(text, x, y);
  }

  async function handleMoveNote(noteId: string, x: number, y: number): Promise<void> {
    const { x: newX, y: newY } = findEmptyPosition(x, y, notes, noteId);
    await moveNote(noteId, newX, newY);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <NoteInput addNote={handleAddNote} disabled={boardLoading || !currentBoard} />
      <Canvas
        notes={notes}
        links={links}
        onEdit={editNote}
        onRemove={removeNote}
        onMove={handleMoveNote}
        onAddLink={addLink}
        onRemoveLink={removeLink}
      />
    </div>
  );
}
