import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Board, BoardSkin, Note } from '@/types';

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
  return onSnapshot(
    boardsCol(userId),
    (snap) => {
      const boards = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Board)
        .filter((b) => b.isActive)
        .sort((a, b) => a.createdAt?.toMillis?.() - b.createdAt?.toMillis?.());
      onUpdate(boards);
    },
    (err) => console.error('[subscribeBoards]', err)
  );
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

// ── メモのパスヘルパー ──────────────────────────────────────────

function notesCol(userId: string, boardId: string) {
  return collection(db, 'users', userId, 'boards', boardId, 'notes');
}

function noteRef(userId: string, boardId: string, noteId: string) {
  return doc(db, 'users', userId, 'boards', boardId, 'notes', noteId);
}

// ── メモの読み書き関数 ──────────────────────────────────────────

/** isActive:true のメモをリアルタイムで購読する */
export function subscribeNotes(
  userId: string,
  boardId: string,
  onUpdate: (notes: Note[]) => void
): Unsubscribe {
  return onSnapshot(
    notesCol(userId, boardId),
    (snap) => {
      const notes = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Note)
        .filter((n) => n.isActive)
        .sort((a, b) => a.createdAt?.toMillis?.() - b.createdAt?.toMillis?.());
      onUpdate(notes);
    },
    (err) => console.error('[subscribeNotes]', err)
  );
}

/** 新しいメモを作成して docId を返す */
export async function createNote(
  userId: string,
  boardId: string,
  text: string,
  x: number,
  y: number
): Promise<string> {
  const ref = await addDoc(notesCol(userId, boardId), {
    text,
    x,
    y,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** メモのテキストを更新する */
export async function updateNoteText(
  userId: string,
  boardId: string,
  noteId: string,
  text: string
): Promise<void> {
  await updateDoc(noteRef(userId, boardId, noteId), {
    text,
    updatedAt: serverTimestamp(),
  });
}

/** メモの位置を更新する（ドラッグ終了時のみ呼ぶ） */
export async function updateNotePosition(
  userId: string,
  boardId: string,
  noteId: string,
  x: number,
  y: number
): Promise<void> {
  await updateDoc(noteRef(userId, boardId, noteId), {
    x,
    y,
    updatedAt: serverTimestamp(),
  });
}

/** メモを論理削除する（isActive: false） */
export async function deactivateNote(
  userId: string,
  boardId: string,
  noteId: string
): Promise<void> {
  await updateDoc(noteRef(userId, boardId, noteId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
}
