import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  getDocs,
  query,
  where,
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

// ── リンクのパスヘルパー ────────────────────────────────────────

function linksCol(userId: string, boardId: string) {
  return collection(db, 'users', userId, 'boards', boardId, 'links');
}

function linkRef(userId: string, boardId: string, linkId: string) {
  return doc(db, 'users', userId, 'boards', boardId, 'links', linkId);
}

// ── リンクの読み書き関数 ────────────────────────────────────────

/** isActive:true のリンクをリアルタイムで購読する */
export function subscribeLinks(
  userId: string,
  boardId: string,
  onUpdate: (links: import('@/types').Link[]) => void
): Unsubscribe {
  return onSnapshot(
    linksCol(userId, boardId),
    (snap) => {
      const links = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as import('@/types').Link)
        .filter((l) => l.isActive);
      onUpdate(links);
    },
    (err) => console.error('[subscribeLinks]', err)
  );
}

/** 新しいリンクを作成して docId を返す */
export async function createLink(
  userId: string,
  boardId: string,
  a: string,
  b: string
): Promise<string> {
  const ref = await addDoc(linksCol(userId, boardId), {
    a,
    b,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** リンクを論理削除する（isActive: false） */
export async function deactivateLink(
  userId: string,
  boardId: string,
  linkId: string
): Promise<void> {
  await updateDoc(linkRef(userId, boardId, linkId), {
    isActive: false,
  });
}

/**
 * メモに関連するすべてのアクティブなリンクを論理削除する。
 * メモ削除時に呼び出すことで孤立リンクを防ぐ。
 */
export async function deactivateLinksForNote(
  userId: string,
  boardId: string,
  noteId: string,
): Promise<void> {
  const col = linksCol(userId, boardId);
  // a / b 各フィールドへの単一フィールドクエリ（自動インデックス）を並列実行
  const [snapA, snapB] = await Promise.all([
    getDocs(query(col, where('a', '==', noteId))),
    getDocs(query(col, where('b', '==', noteId))),
  ]);

  // isActive: true のものだけをクライアント側で絞り込んで更新
  const updates: Promise<void>[] = [
    ...snapA.docs.filter((d) => d.data().isActive).map((d) => updateDoc(d.ref, { isActive: false })),
    ...snapB.docs.filter((d) => d.data().isActive).map((d) => updateDoc(d.ref, { isActive: false })),
  ];
  await Promise.all(updates);
}
