'use client';

import Link from 'next/link';
import { useBoardsContext } from '@/contexts/BoardsContext';
import { useNotes } from '@/hooks/useNotes';
import { useLinks } from '@/hooks/useLinks';
import { useToast } from '@/contexts/ToastContext';
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
  const showToast = useToast();

  const skin = currentBoard?.skin ?? 'leaf';

  async function handleAddLink(a: string, b: string): Promise<string> {
    try {
      return await addLink(a, b);
    } catch (e) {
      console.error('[ListPage] addLink failed:', e);
      showToast('つながりの変更に失敗しました。再度お試しください。');
      throw e;
    }
  }

  async function handleRemoveLink(linkId: string): Promise<void> {
    try {
      await removeLink(linkId);
    } catch (e) {
      console.error('[ListPage] removeLink failed:', e);
      showToast('つながりの変更に失敗しました。再度お試しください。');
      throw e;
    }
  }

  if (boardLoading) {
    return (
      <div
        className={`flex flex-1 items-center justify-center text-sm skin-${skin}`}
        style={{ background: 'var(--field)', color: 'var(--ink-soft)' }}
      >
        読み込み中…
      </div>
    );
  }

  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden skin-${skin}`}
      style={{ background: 'var(--field)', color: 'var(--ink)' }}
    >
      {/* キャンバスへ戻るボタン */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--dusk)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="10,3 5,8 10,13"/>
          </svg>
          キャンバスへ戻る
        </Link>
      </div>

      <GroupList
        notes={notes}
        links={links}
        onAddLink={handleAddLink}
        onRemoveLink={handleRemoveLink}
      />
    </div>
  );
}
