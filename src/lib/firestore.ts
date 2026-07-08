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
  runTransaction,
  writeBatch,
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
    query(boardsCol(userId), where('isActive', '==', true)),
    (snap) => {
      const boards = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Board)
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

/**
 * ボードを論理削除する（isActive: false）。
 *
 * Web SDKのTransaction.get()はDocumentReferenceのみ受け付けクエリを渡せないため、
 * 「他にアクティブなボードがあるか」の候補となるボードIDを先に通常クエリで洗い出し、
 * トランザクション内でそれぞれのドキュメントを個別に読み直して最新のisActiveを確認する。
 * これにより、候補ボードのいずれかが同時に非アクティブ化された場合はトランザクションが
 * 自動的に再試行され、最後の1枚を消してしまうことはない。
 *
 * 配下のアクティブな notes / links も孤児化を防ぐため、同一トランザクションで連鎖して論理削除する。
 */
export async function deactivateBoard(
  userId: string,
  boardId: string
): Promise<'ok' | 'last-board'> {
  const otherActiveBoardsSnap = await getDocs(
    query(boardsCol(userId), where('isActive', '==', true))
  );
  const candidateRefs = otherActiveBoardsSnap.docs
    .map((d) => d.ref)
    .filter((ref) => ref.id !== boardId);

  const [notesSnap, linksSnap] = await Promise.all([
    getDocs(query(notesCol(userId, boardId), where('isActive', '==', true))),
    getDocs(query(linksCol(userId, boardId), where('isActive', '==', true))),
  ]);

  return runTransaction(db, async (tx) => {
    // tx.get() は転送順序に依存するため並列化せず1件ずつ読む
    let hasActiveOther = false;
    for (const ref of candidateRefs) {
      const snap = await tx.get(ref);
      if (snap.exists() && snap.data().isActive) {
        hasActiveOther = true;
        break;
      }
    }
    if (!hasActiveOther) return 'last-board';

    tx.update(boardRef(userId, boardId), { isActive: false, updatedAt: serverTimestamp() });
    notesSnap.docs.forEach((d) =>
      tx.update(d.ref, { isActive: false, updatedAt: serverTimestamp() })
    );
    linksSnap.docs.forEach((d) =>
      tx.update(d.ref, { isActive: false, updatedAt: serverTimestamp() })
    );
    return 'ok';
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
    query(notesCol(userId, boardId), where('isActive', '==', true)),
    (snap) => {
      const notes = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Note)
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

/**
 * メモを論理削除する（isActive: false）。
 * 関連するアクティブなリンク（a/bどちらか一致）も孤立を防ぐため、同一writeBatchでアトミックに論理削除する。
 */
export async function deactivateNote(
  userId: string,
  boardId: string,
  noteId: string
): Promise<void> {
  const col = linksCol(userId, boardId);
  const [snapA, snapB] = await Promise.all([
    getDocs(query(col, where('a', '==', noteId), where('isActive', '==', true))),
    getDocs(query(col, where('b', '==', noteId), where('isActive', '==', true))),
  ]);

  const batch = writeBatch(db);
  batch.update(noteRef(userId, boardId, noteId), { isActive: false, updatedAt: serverTimestamp() });
  snapA.docs.forEach((d) => batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() }));
  snapB.docs.forEach((d) => batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() }));
  await batch.commit();
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
    query(linksCol(userId, boardId), where('isActive', '==', true)),
    (snap) => {
      const links = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as import('@/types').Link);
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
    updatedAt: serverTimestamp(),
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
    updatedAt: serverTimestamp(),
  });
}

/**
 * ボード内のアクティブなメモとリンクをすべて論理削除する（一括削除）。
 * constraints.md ルール #8: isActive: false での論理削除のみ（物理削除禁止）
 */
export async function deactivateAllNotesAndLinks(
  userId: string,
  boardId: string,
): Promise<void> {
  const [notesSnap, linksSnap] = await Promise.all([
    getDocs(query(notesCol(userId, boardId), where('isActive', '==', true))),
    getDocs(query(linksCol(userId, boardId), where('isActive', '==', true))),
  ]);
  await Promise.all([
    ...notesSnap.docs.map((d) =>
      updateDoc(d.ref, { isActive: false, updatedAt: serverTimestamp() })
    ),
    ...linksSnap.docs.map((d) =>
      updateDoc(d.ref, { isActive: false, updatedAt: serverTimestamp() })
    ),
  ]);
}
