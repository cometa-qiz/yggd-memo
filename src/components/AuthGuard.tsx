'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // trailingSlash: true により dev サーバーが /login → /login/ にリダイレクトするため両方に対応する
  const isLoginPage = pathname === '/login' || pathname === '/login/';

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) {
      router.replace('/login');
    }
  }, [user, loading, isLoginPage, router]);

  // /login ページは認証不要なので常に表示する
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 認証状態確定待ち、または未認証（リダイレクト中）
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-400">読み込み中...</p>
      </div>
    );
  }

  return <>{children}</>;
}
