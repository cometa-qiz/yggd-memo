'use client';

import { useBoardsContext } from '@/contexts/BoardsContext';
import { useNotes } from '@/hooks/useNotes';
import { useLinks } from '@/hooks/useLinks';
import { GroupList } from '@/components/list/GroupList';

/**
 * リスト画面（/list）。
 * メモのつながりをグループ・木構造で一覧表示し、CSV/JSON の書き出しを提供する。
 */
export default function ListPage() {
  const { currentBoard, loading: boardLoading } = useBoardsContext();
  const boardId = currentBoard?.id ?? null;
  const { notes } = useNotes(boardId);
  const { links, addLink, removeLink } = useLinks(boardId);

  if (boardLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <GroupList
        notes={notes}
        links={links}
        onAddLink={addLink}
        onRemoveLink={removeLink}
      />
    </div>
  );
}
