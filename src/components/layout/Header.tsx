'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useBoardsContext } from '@/contexts/BoardsContext';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const pathname = usePathname();
  const { boards, currentBoard, switchBoard } = useBoardsContext();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる（hooks はすべて条件 return の前に呼ぶ）
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // ログインページでは非表示
  if (pathname === '/login' || pathname === '/login/') return null;

  return (
    <header className="sticky top-0 z-10 h-12 flex items-center gap-3 px-4 bg-white border-b border-zinc-100 shrink-0">
      {/* ロゴ */}
      <span className="text-sm font-semibold text-zinc-900 shrink-0 select-none">
        Yggd-memo
      </span>

      {/* ボード切り替えドロップダウン */}
      <select
        value={currentBoard?.id ?? ''}
        onChange={(e) => switchBoard(e.target.value)}
        className="flex-1 min-w-0 max-w-xs text-sm border border-zinc-200 rounded-lg px-3 py-1 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-300 cursor-pointer"
        aria-label="ボードを切り替える"
      >
        {boards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.name}
          </option>
        ))}
      </select>

      {/* ユーザーアイコン + サインアウトメニュー */}
      <div className="relative ml-auto shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center hover:ring-2 hover:ring-zinc-200 transition-shadow"
          aria-label="ユーザーメニュー"
          aria-expanded={menuOpen}
        >
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName ?? 'ユーザー'}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-medium text-zinc-600 select-none">
              {user?.displayName?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-1 w-44 rounded-xl border border-zinc-100 bg-white shadow-lg py-1">
            {user?.displayName && (
              <p className="px-4 py-2 text-xs text-zinc-400 truncate border-b border-zinc-50">
                {user.displayName}
              </p>
            )}
            <button
              onClick={() => {
                signOut();
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              サインアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
