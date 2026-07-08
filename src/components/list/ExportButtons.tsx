'use client';

import { exportAsCSV, exportAsJSON, triggerDownload } from '@/utils/exportUtils';
import type { NoteGroup } from '@/utils/graphUtils';

type Props = {
  groups: NoteGroup[];
  /**
   * groups[i] の現在の根ノードID（groups と同じ順序）。
   * 「根にする」による上書きを反映した値を渡すこと。
   */
  rootIds: string[];
};

/**
 * リスト画面の下端に表示する書き出しボタン群。
 * CSV: インデント形式テキスト（.csv）
 * JSON: ネスト構造 JSON（.json）
 */
export function ExportButtons({ groups, rootIds }: Props) {
  const isEmpty = groups.length === 0;

  function handleExportCSV() {
    const content = exportAsCSV(groups, rootIds);
    triggerDownload(content, 'yggd-memo.csv', 'text/plain;charset=utf-8');
  }

  function handleExportJSON() {
    const content = exportAsJSON(groups, rootIds);
    triggerDownload(content, 'yggd-memo.json', 'application/json;charset=utf-8');
  }

  return (
    <div
      className="flex shrink-0 items-center gap-2 px-4 py-3"
      style={{
        borderTop: '1px solid var(--line)',
        background: 'var(--paper)',
      }}
    >
      <span className="mr-1 text-xs" style={{ color: 'var(--ink-soft)' }}>書き出し</span>
      <button
        onClick={handleExportCSV}
        disabled={isEmpty}
        className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
        style={{
          border: '1px solid var(--line)',
          background: 'transparent',
          color: 'var(--ink)',
        }}
      >
        CSV
      </button>
      <button
        onClick={handleExportJSON}
        disabled={isEmpty}
        className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
        style={{
          border: '1px solid var(--line)',
          background: 'transparent',
          color: 'var(--ink)',
        }}
      >
        JSON
      </button>
    </div>
  );
}
