'use client';

import { useBoardsContext } from '@/contexts/BoardsContext';
import { SkinSelector } from '@/components/settings/SkinSelector';
import { BoardManager } from '@/components/settings/BoardManager';
import { DangerZone } from '@/components/settings/DangerZone';

export default function SettingsPage() {
  const { loading } = useBoardsContext();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-10">
        <h1 className="text-lg font-semibold text-zinc-800">設定</h1>

        {/* ─── セクション1: 現在のボードの設定 ─────────────────────── */}
        <SkinSelector />

        {/* ─── セクション2: ボード一覧・管理 ───────────────────────── */}
        <BoardManager />

        {/* ─── セクション3: 危険な操作・アカウント ─────────────────── */}
        <DangerZone />
      </div>
    </div>
  );
}
