'use client';

import { createContext, useContext } from 'react';
import { useBoards } from '@/hooks/useBoards';

type BoardsContextValue = ReturnType<typeof useBoards>;

const BoardsContext = createContext<BoardsContextValue | null>(null);

export function BoardsProvider({ children }: { children: React.ReactNode }) {
  const value = useBoards();
  return <BoardsContext.Provider value={value}>{children}</BoardsContext.Provider>;
}

export function useBoardsContext(): BoardsContextValue {
  const ctx = useContext(BoardsContext);
  if (!ctx) throw new Error('useBoardsContext: BoardsProvider が見つかりません');
  return ctx;
}
