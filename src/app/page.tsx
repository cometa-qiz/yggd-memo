'use client';

import { useBoardsContext } from '@/contexts/BoardsContext';
import { useNotes } from '@/hooks/useNotes';
import { useLinks } from '@/hooks/useLinks';
import { useCanvasView } from '@/hooks/useCanvasView';
import { NoteInput } from '@/components/layout/NoteInput';
import { Canvas } from '@/components/canvas/Canvas';
import { findEmptyPosition } from '@/utils/positionUtils';

// NoteCard の視覚的な中心オフセット（Canvas.tsx の CARD_CX / CARD_CY と同値）
const CARD_CX = 100;
const CARD_CY = 40;

export default function Home() {
  const { currentBoard, loading: boardLoading } = useBoardsContext();
  const { notes, addNote, editNote, removeNote, moveNote } = useNotes(currentBoard?.id ?? null);
  const { links, addLink, removeLink } = useLinks(currentBoard?.id ?? null);
  const view = useCanvasView();

  async function handleAddNote(text: string): Promise<string> {
    // 現在の表示領域の中心をワールド座標で取得し、カードが画面中央付近に出るよう配置する
    const center = view.viewportCenterWorld();
    const desiredX = Math.max(0, Math.round(center.x - CARD_CX));
    const desiredY = Math.max(0, Math.round(center.y - CARD_CY));
    const { x, y } = findEmptyPosition(desiredX, desiredY, notes);
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
        skin={currentBoard?.skin ?? 'leaf'}
        view={view}
        onEdit={editNote}
        onRemove={removeNote}
        onMove={handleMoveNote}
        onAddLink={addLink}
        onRemoveLink={removeLink}
      />
    </div>
  );
}
