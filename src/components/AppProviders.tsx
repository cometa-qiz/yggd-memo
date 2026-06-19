'use client';

import { BoardsProvider } from '@/contexts/BoardsContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <BoardsProvider>{children}</BoardsProvider>;
}
