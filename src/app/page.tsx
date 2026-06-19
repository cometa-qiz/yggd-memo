'use client';

import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 px-10 py-12 flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Yggd-memo</h1>

        {user && (
          <div className="w-full flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">ユーザー名</span>
              <span className="text-zinc-800 font-medium">{user.displayName ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">UID</span>
              <span className="text-zinc-600 font-mono text-xs break-all">{user.uid}</span>
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          className="w-full rounded-full border border-zinc-200 px-6 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          サインアウト
        </button>
      </div>
    </div>
  );
}
