'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import {
  subscribeBoards,
  createBoard,
  updateBoardName,
  updateBoardSkin,
  deactivateBoard,
} from '@/lib/firestore';
import type { Board, BoardSkin } from '@/types';

type UseBoardsReturn = {
  boards: Board[];
  loading: boolean;
  currentBoard: Board | null;
  switchBoard: (boardId: string) => void;
  addBoard: (name: string) => Promise<string>;
  renameBoard: (boardId: string, name: string) => Promise<void>;
  changeBoardSkin: (boardId: string, skin: BoardSkin) => Promise<void>;
  removeBoard: (boardId: string) => Promise<void>;
};

export function useBoards(): UseBoardsReturn {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  // onSnapshot が複数回発火しても初回の空リスト時に1回だけ作成するためのフラグ
  const autoCreatedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    autoCreatedRef.current = false;
    const unsubscribe = subscribeBoards(user.uid, (updated) => {
      setBoards(updated);
      setLoading(false);
      // ボードが0件のとき「メインボード」を自動作成（重複防止フラグあり）
      if (updated.length === 0 && !autoCreatedRef.current) {
        autoCreatedRef.current = true;
        createBoard(user.uid, 'メインボード');
      }
      // 現在のボードが削除された場合は先頭ボードへフォールバック
      setCurrentBoardId((prev) => {
        if (prev && updated.some((b) => b.id === prev)) return prev;
        return updated[0]?.id ?? null;
      });
    });
    return () => unsubscribe();
  }, [user]);

  const currentBoard = boards.find((b) => b.id === currentBoardId) ?? null;

  const switchBoard = useCallback((boardId: string) => {
    setCurrentBoardId(boardId);
  }, []);

  const addBoard = useCallback(
    async (name: string): Promise<string> => {
      if (!user) throw new Error('Not authenticated');
      const id = await createBoard(user.uid, name);
      setCurrentBoardId(id);
      return id;
    },
    [user]
  );

  const renameBoard = useCallback(
    async (boardId: string, name: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      await updateBoardName(user.uid, boardId, name);
    },
    [user]
  );

  const changeBoardSkin = useCallback(
    async (boardId: string, skin: BoardSkin): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      await updateBoardSkin(user.uid, boardId, skin);
    },
    [user]
  );

  const removeBoard = useCallback(
    async (boardId: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      // 最後の1枚は削除不可（constraints.md ルール #10）。
      // ここでの判定はネットワーク往復を避けるための事前チェックに過ぎず、
      // 実際の不変条件保証は deactivateBoard 内のトランザクションが担う。
      if (boards.length <= 1) return;
      await deactivateBoard(user.uid, boardId);
    },
    [user, boards.length]
  );

  return {
    boards,
    loading,
    currentBoard,
    switchBoard,
    addBoard,
    renameBoard,
    changeBoardSkin,
    removeBoard,
  };
}
