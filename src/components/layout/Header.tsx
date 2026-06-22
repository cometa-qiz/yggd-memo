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
      {/* ロゴ: クリックでキャンバス（/）へ。mask で --ink 色に追従 */}
      <Link href="/" aria-label="キャンバスへ戻る" className="shrink-0 flex items-center">
        <span
          aria-hidden
          className="block"
          style={{
            width: '34px',
            height: '32px',
            backgroundColor: 'var(--ink)',
            WebkitMask: 'url(/logo-mask.png) center / contain no-repeat',
            mask: 'url(/logo-mask.png) center / contain no-repeat',
            transition: 'background-color 0.3s ease',
          }}
        />
      </Link>

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

      {/* ナビゲーション: リスト・設定 */}
      <nav className="flex items-center gap-1 shrink-0" aria-label="メインナビゲーション">
        <Link
          href="/list"
          aria-label="リスト画面"
          title="リスト"
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          style={{
            color: pathname === '/list' ? 'var(--dusk)' : 'var(--ink-soft)',
            background: pathname === '/list' ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="5" x2="15" y2="5"/>
            <line x1="3" y1="9" x2="15" y2="9"/>
            <line x1="3" y1="13" x2="15" y2="13"/>
          </svg>
        </Link>
        <Link
          href="/settings"
          aria-label="設定画面"
          title="設定"
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          style={{
            color: pathname === '/settings' ? 'var(--dusk)' : 'var(--ink-soft)',
            background: pathname === '/settings' ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="2" x2="6" y2="16"/>
            <line x1="12" y1="2" x2="12" y2="16"/>
            <circle cx="6" cy="7" r="2" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="11" r="2" fill="currentColor" stroke="none"/>
          </svg>
        </Link>
      </nav>

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
