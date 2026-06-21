'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
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

  const skin = currentBoard?.skin ?? 'leaf';

  return (
    <header
      className={`sticky top-0 z-10 h-12 flex items-center gap-3 px-4 shrink-0 skin-${skin}`}
      style={{
        background: 'var(--header-grad)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {/* ロゴ: logo-mask.svg を CSS mask で表示し、--ink 色（スキン連動）で塗る */}
      <span
        aria-hidden
        className="shrink-0 w-5 h-5 block"
        style={{
          backgroundColor: 'var(--ink)',
          WebkitMaskImage: 'url(/logo-mask.svg)',
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskImage: 'url(/logo-mask.svg)',
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          transition: 'background-color 0.3s ease',
        }}
      />
      <span className="text-sm font-semibold shrink-0 select-none" style={{ color: 'var(--ink)' }}>
        Yggd-memo
      </span>

      {/* ボード切り替えドロップダウン */}
      <select
        value={currentBoard?.id ?? ''}
        onChange={(e) => switchBoard(e.target.value)}
        className="flex-1 min-w-0 max-w-xs text-sm rounded-lg px-3 py-1 focus:outline-none cursor-pointer"
        style={{
          background: 'var(--glass)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
        }}
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
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              設定
            </Link>
            <button
              onClick={() => {
                signOut();
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors border-t border-zinc-50"
            >
              サインアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
