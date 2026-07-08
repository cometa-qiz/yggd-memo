'use client';

import { useState } from 'react';
import { useBoardsContext } from '@/contexts/BoardsContext';
import { useAuth } from '@/hooks/useAuth';
import { fetchBoardExportData } from '@/lib/firestore';
import { groupNotes } from '@/utils/graphUtils';
import {
  exportAllBoardsAsCSV,
  exportAllBoardsAsJSON,
  triggerDownload,
  type BoardExportData,
} from '@/utils/exportUtils';

/**
 * 現在アクティブな全ボードのnotes/linksをまとめて取得し、書き出し用データに変換する。
 * R2-6: scripts/cleanup-soft-deleted.mjs（物理削除）を実行する前の手動バックアップ手段。
 */
async function collectAllBoardsData(
  userId: string,
  boards: { id: string; name: string }[]
): Promise<BoardExportData[]> {
  const perBoard = await Promise.all(
    boards.map(async (board) => {
      const { notes, links } = await fetchBoardExportData(userId, board.id);
      return { boardName: board.name, groups: groupNotes(notes, links) };
    })
  );
  return perBoard;
}

export function AllBoardsExport() {
  const { boards } = useBoardsContext();
  const { user } = useAuth();
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);

  const isEmpty = boards.length === 0;

  async function handleExport(format: 'csv' | 'json') {
    if (!user || exporting) return;
    setExporting(format);
    try {
      const data = await collectAllBoardsData(user.uid, boards);
      if (format === 'csv') {
        triggerDownload(exportAllBoardsAsCSV(data), 'yggd-memo-all-boards.csv', 'text/plain;charset=utf-8');
      } else {
        triggerDownload(exportAllBoardsAsJSON(data), 'yggd-memo-all-boards.json', 'application/json;charset=utf-8');
      }
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="space-y-4">
      <h2
        className="text-sm font-semibold uppercase tracking-wide"
        style={{ color: 'var(--ink-soft)' }}
      >
        全ボードの書き出し
      </h2>

      <div
        className="rounded-xl px-4 py-4 space-y-2"
        style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
      >
        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          全てのボードのメモとつながりを1つのファイルにまとめて書き出します。
          手元にバックアップを残したいときにお使いください。
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={isEmpty || exporting !== null}
            className="text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ border: '1px solid var(--line)', color: 'var(--ink)', background: 'transparent' }}
          >
            {exporting === 'csv' ? '書き出し中…' : '全ボードをCSVで書き出す'}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={isEmpty || exporting !== null}
            className="text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ border: '1px solid var(--line)', color: 'var(--ink)', background: 'transparent' }}
          >
            {exporting === 'json' ? '書き出し中…' : '全ボードをJSONで書き出す'}
          </button>
        </div>
      </div>
    </section>
  );
}
