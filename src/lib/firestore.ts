import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Board, BoardSkin } from '@/types';

// ── パスヘルパー ───────────────────────────────────────────────

function boardsCol(userId: string) {
  return collection(db, 'users', userId, 'boards');
}

function boardRef(userId: string, boardId: string) {
  return doc(db, 'users', userId, 'boards', boardId);
}

// ── ボードの読み書き関数 ────────────────────────────────────────

/** isActive:true のボードをリアルタイムで購読する */
export function subscribeBoards(
  userId: string,
  onUpdate: (boards: Board[]) => void
): Unsubscribe {
  const q = query(
    boardsCol(userId),
    where('isActive', '==', true),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const boards = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Board);
    onUpdate(boards);
  });
}

/** 新しいボードを作成して docId を返す */
export async function createBoard(
  userId: string,
  name: string,
  skin: BoardSkin = 'leaf'
): Promise<string> {
  const ref = await addDoc(boardsCol(userId), {
    name,
    skin,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** ボード名を変更する */
export async function updateBoardName(
  userId: string,
  boardId: string,
  name: string
): Promise<void> {
  await updateDoc(boardRef(userId, boardId), {
    name,
    updatedAt: serverTimestamp(),
  });
}

/** ボードのスキンを変更する */
export async function updateBoardSkin(
  userId: string,
  boardId: string,
  skin: BoardSkin
): Promise<void> {
  await updateDoc(boardRef(userId, boardId), {
    skin,
    updatedAt: serverTimestamp(),
  });
}

/** ボードを論理削除する（isActive: false） */
export async function deactivateBoard(
  userId: string,
  boardId: string
): Promise<void> {
  await updateDoc(boardRef(userId, boardId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
}
