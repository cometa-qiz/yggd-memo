'use client';

import { useState } from 'react';
import type { Note, Link } from '@/types';
import { groupNotes } from '@/utils/graphUtils';
import { GroupItem } from './GroupItem';
import { ExportButtons } from './ExportButtons';

type Props = {
  notes: Note[];
  links: Link[];
  onAddLink: (a: string, b: string) => Promise<string>;
  onRemoveLink: (linkId: string) => Promise<void>;
};

/**
 * アクティブなメモをグループ化して一覧表示する。
 * - つながりのあるメモグループ（2件以上）を上段に表示
 * - 単独のメモを「単独のメモ」セクションにまとめて下段に表示
 * - 根の上書き（「根にする」）はローカル state で管理し、保存しない
 * - ExportButtons を下端に固定表示し、現在の根表示を反映して書き出す
 */
export function GroupList({ notes, links, onAddLink, onRemoveLink }: Props) {
  const groups = groupNotes(notes, links);

  /** グループインデックス → 上書き後の根メモID（再訪問でリセットされる） */
  const [rootOverrides, setRootOverrides] = useState<Map<number, string>>(
    () => new Map()
  );

  function handleSetRoot(groupIndex: number, noteId: string) {
    setRootOverrides((prev) => {
      const next = new Map(prev);
      next.set(groupIndex, noteId);
      return next;
    });
  }

  function handleResetRoot(groupIndex: number) {
    setRootOverrides((prev) => {
      const next = new Map(prev);
      next.delete(groupIndex);
      return next;
    });
  }

  const connectedGroups = groups.filter((g) => g.notes.length > 1);
  const soloGroups = groups.filter((g) => g.notes.length === 1);

  /**
   * groups 配列と同じ順序で各グループの現在の根ノードIDを解決する。
   * groupNotes は件数降順で返すため、connected groups は先頭に固まる。
   * ExportButtons に渡し、「根にする」上書きを書き出しに反映する。
   */
  const rootIds = groups.map((g, i) => {
    if (i < connectedGroups.length) {
      // connected group: rootOverrides キーはそのまま groups のインデックス
      return rootOverrides.get(i) ?? g.defaultRootId;
    }
    // solo group: ノードが1件しかないので defaultRootId で確定
    return g.defaultRootId;
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* スクロール可能なグループ一覧 */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            メモがありません
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {/* つながりのあるグループ */}
            {connectedGroups.map((group, i) => (
              <GroupItem
                key={group.defaultRootId}
                group={group}
                rootId={rootOverrides.get(i) ?? group.defaultRootId}
                isRootOverridden={rootOverrides.has(i)}
                onSetRoot={(noteId) => handleSetRoot(i, noteId)}
                onResetRoot={() => handleResetRoot(i)}
                onAddLink={onAddLink}
                onRemoveLink={onRemoveLink}
              />
            ))}

            {/* 単独のメモ */}
            {soloGroups.length > 0 && (
              <section>
                <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  単独のメモ（{soloGroups.length}件）
                </h2>
                <div className="flex flex-col gap-1">
                  {soloGroups.map((group) => (
                    <div
                      key={group.notes[0].id}
                      className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
                    >
                      {group.notes[0].text}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* 書き出しボタン（固定フッター）*/}
      <ExportButtons groups={groups} rootIds={rootIds} />
    </div>
  );
}
