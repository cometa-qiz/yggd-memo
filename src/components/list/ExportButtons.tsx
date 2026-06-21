'use client';

import { exportAsCSV, exportAsJSON } from '@/utils/exportUtils';
import type { NoteGroup } from '@/utils/graphUtils';

type Props = {
  groups: NoteGroup[];
  /**
   * groups[i] の現在の根ノードID（groups と同じ順序）。
   * 「根にする」による上書きを反映した値を渡すこと。
   */
  rootIds: string[];
};

/** Blob URL を使ってファイルをブラウザでダウンロードする */
function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
    <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white px-4 py-3">
      <span className="mr-1 text-xs text-gray-400">書き出し</span>
      <button
        onClick={handleExportCSV}
        disabled={isEmpty}
        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        CSV
      </button>
      <button
        onClick={handleExportJSON}
        disabled={isEmpty}
        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        JSON
      </button>
    </div>
  );
}
