'use client';

import Link from 'next/link';
import { useBoardsContext } from '@/contexts/BoardsContext';
import { SkinSelector } from '@/components/settings/SkinSelector';
import { BoardManager } from '@/components/settings/BoardManager';
import { DangerZone } from '@/components/settings/DangerZone';

export default function SettingsPage() {
  const { loading, currentBoard } = useBoardsContext();
  const skin = currentBoard?.skin ?? 'leaf';

  if (loading) {
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
      className={`flex-1 overflow-y-auto skin-${skin}`}
      style={{ background: 'var(--field)', color: 'var(--ink)' }}
    >
      <div className="max-w-lg mx-auto px-4 py-8 space-y-10">
        {/* キャンバスへ戻るボタン */}
        <div>
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

        <h1 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>設定</h1>

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
