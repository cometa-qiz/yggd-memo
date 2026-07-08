/**
 * Firestore セキュリティルール検証スクリプト
 * 使い方: node scripts/test-firestore-rules.mjs
 * 前提: firebase emulators:start --only firestore が起動済みであること
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesPath = resolve(__dirname, '..', 'firestore.rules');

// @firebase/rules-unit-testing を動的 import
const { initializeTestEnvironment, assertSucceeds, assertFails } = await import(
  '@firebase/rules-unit-testing'
);
const { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, Timestamp } = await import(
  'firebase/firestore'
);

// ── カラーヘルパー ──────────────────────────────────────────
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(green('  ✓') + ' ' + name);
    passed++;
  } catch (e) {
    console.log(red('  ✗') + ' ' + name);
    console.log('    ' + red(e.message?.split('\n')[0] ?? String(e)));
    failed++;
  }
}

// ── テスト環境の初期化 ──────────────────────────────────────
console.log(bold('\n▶ Firestore rules テスト開始'));
console.log('  ルールファイル:', rulesPath);

const testEnv = await initializeTestEnvironment({
  projectId: 'yggd-memo',
  firestore: {
    rules: readFileSync(rulesPath, 'utf8'),
    host: 'localhost',
    port: 8080,
  },
});

const USER_A = 'userA';
const USER_B = 'userB';

// serverTimestamp の代わりに Timestamp.now() を使用
const now = () => Timestamp.now();

// ── 各テスト ────────────────────────────────────────────────

// ---- 共通: 未認証アクセスの拒否 ----------------------------
console.log(bold('\n[共通] 未認証アクセスの拒否'));
{
  const unauthed = testEnv.unauthenticatedContext();
  const db = unauthed.firestore();

  await test('未認証: ボードの読み取りが拒否される', () =>
    assertFails(getDoc(doc(db, 'users', USER_A, 'boards', 'b1')))
  );
  await test('未認証: ボードの書き込みが拒否される', () =>
    assertFails(addDoc(collection(db, 'users', USER_A, 'boards'), {
      name: 'Test', skin: 'leaf', isActive: true, createdAt: now(), updatedAt: now()
    }))
  );
}

// ---- 他ユーザーのデータへのアクセス拒否 ---------------------
console.log(bold('\n[共通] 他ユーザーデータへのアクセス拒否'));
{
  const ctxB = testEnv.authenticatedContext(USER_B);
  const db = ctxB.firestore();

  await test('userB が userA のボードを読めない', () =>
    assertFails(getDoc(doc(db, 'users', USER_A, 'boards', 'b1')))
  );
  await test('userB が userA のボードを作れない', () =>
    assertFails(addDoc(collection(db, 'users', USER_A, 'boards'), {
      name: 'Test', skin: 'leaf', isActive: true, createdAt: now(), updatedAt: now()
    }))
  );
}

// ---- Board CRUD -------------------------------------------
console.log(bold('\n[Board] CRUD 操作'));
{
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', USER_A, 'boards', 'board1'), {
      name: '初期ボード', skin: 'leaf', isActive: true,
      createdAt: now(), updatedAt: now()
    });
  });

  const ctx = testEnv.authenticatedContext(USER_A);
  const db = ctx.firestore();

  await test('ボード作成（正常）', () =>
    assertSucceeds(addDoc(collection(db, 'users', USER_A, 'boards'), {
      name: 'テストボード', skin: 'cloud', isActive: true, createdAt: now(), updatedAt: now()
    }))
  );

  await test('ボード読み取り', () =>
    assertSucceeds(getDoc(doc(db, 'users', USER_A, 'boards', 'board1')))
  );

  await test('ボード名更新', () =>
    assertSucceeds(updateDoc(doc(db, 'users', USER_A, 'boards', 'board1'), {
      name: '更新後ボード名', updatedAt: now()
    }))
  );

  await test('ボード論理削除（isActive: false）', () =>
    assertSucceeds(updateDoc(doc(db, 'users', USER_A, 'boards', 'board1'), {
      isActive: false, updatedAt: now()
    }))
  );

  await test('ボード物理削除が拒否される', () =>
    assertFails(deleteDoc(doc(db, 'users', USER_A, 'boards', 'board1')))
  );

  await test('無効スキン名が拒否される', () =>
    assertFails(addDoc(collection(db, 'users', USER_A, 'boards'), {
      name: 'Bad', skin: 'invalid_skin', isActive: true, createdAt: now(), updatedAt: now()
    }))
  );

  await test('空のボード名が拒否される', () =>
    assertFails(addDoc(collection(db, 'users', USER_A, 'boards'), {
      name: '', skin: 'leaf', isActive: true, createdAt: now(), updatedAt: now()
    }))
  );

  await test('未知フィールドを含む書き込みが拒否される', () =>
    assertFails(addDoc(collection(db, 'users', USER_A, 'boards'), {
      name: 'Test', skin: 'leaf', isActive: true, createdAt: now(), updatedAt: now(),
      unknownField: 'should be rejected'
    }))
  );
}

// ---- Note CRUD -------------------------------------------
console.log(bold('\n[Note] CRUD 操作'));
{
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', USER_A, 'boards', 'board1'), {
      name: 'ボード', skin: 'leaf', isActive: true, createdAt: now(), updatedAt: now()
    });
    await setDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'notes', 'note1'), {
      text: '初期メモ', x: 100, y: 200, isActive: true, createdAt: now(), updatedAt: now()
    });
  });

  const ctx = testEnv.authenticatedContext(USER_A);
  const db = ctx.firestore();

  await test('メモ追加', () =>
    assertSucceeds(addDoc(collection(db, 'users', USER_A, 'boards', 'board1', 'notes'), {
      text: '新しいメモ', x: 50, y: 80, isActive: true, createdAt: now(), updatedAt: now()
    }))
  );

  await test('メモ読み取り', () =>
    assertSucceeds(getDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'notes', 'note1')))
  );

  await test('メモテキスト編集', () =>
    assertSucceeds(updateDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'notes', 'note1'), {
      text: '編集後のメモ', updatedAt: now()
    }))
  );

  await test('メモ座標更新（ドラッグ移動）', () =>
    assertSucceeds(updateDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'notes', 'note1'), {
      x: 300, y: 400, updatedAt: now()
    }))
  );

  await test('メモ論理削除（isActive: false）', () =>
    assertSucceeds(updateDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'notes', 'note1'), {
      isActive: false, updatedAt: now()
    }))
  );

  await test('メモ物理削除が拒否される', () =>
    assertFails(deleteDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'notes', 'note1')))
  );

  await test('10000文字超のテキストが拒否される', () =>
    assertFails(addDoc(collection(db, 'users', USER_A, 'boards', 'board1', 'notes'), {
      text: 'a'.repeat(10001), x: 0, y: 0, isActive: true, createdAt: now(), updatedAt: now()
    }))
  );
}

// ---- Link CRUD -------------------------------------------
console.log(bold('\n[Link] CRUD 操作'));
{
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'links', 'link1'), {
      a: 'note_alpha', b: 'note_beta', isActive: true, createdAt: now(), updatedAt: now()
    });
  });

  const ctx = testEnv.authenticatedContext(USER_A);
  const db = ctx.firestore();

  await test('リンク作成（正常）', () =>
    assertSucceeds(addDoc(collection(db, 'users', USER_A, 'boards', 'board1', 'links'), {
      a: 'note1', b: 'note2', isActive: true, createdAt: now(), updatedAt: now()
    }))
  );

  await test('リンク読み取り', () =>
    assertSucceeds(getDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'links', 'link1')))
  );

  await test('リンク論理削除（isActive: false）', () =>
    assertSucceeds(updateDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'links', 'link1'), {
      isActive: false, updatedAt: now()
    }))
  );

  await test('リンク物理削除が拒否される', () =>
    assertFails(deleteDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'links', 'link1')))
  );

  await test('自己ループ（a == b）が拒否される', () =>
    assertFails(addDoc(collection(db, 'users', USER_A, 'boards', 'board1', 'links'), {
      a: 'same_note', b: 'same_note', isActive: true, createdAt: now(), updatedAt: now()
    }))
  );

  await test('リンクのa/b書き換えが拒否される（不変条件）', () =>
    assertFails(updateDoc(doc(db, 'users', USER_A, 'boards', 'board1', 'links', 'link1'), {
      a: 'changed_note', b: 'note_beta', isActive: false, updatedAt: now()
    }))
  );

  await test('リンクのupdatedAt欠如が拒否される（スキーマ検証）', () =>
    assertFails(addDoc(collection(db, 'users', USER_A, 'boards', 'board1', 'links'), {
      a: 'note3', b: 'note4', isActive: true, createdAt: now()
    }))
  );
}

// ---- 定義外パスのデフォルト拒否 ----------------------------
console.log(bold('\n[パス] 定義外コレクションの拒否'));
{
  const ctx = testEnv.authenticatedContext(USER_A);
  const db = ctx.firestore();

  await test('未定義のトップレベルコレクションが拒否される', () =>
    assertFails(getDoc(doc(db, 'unknown_collection', USER_A)))
  );

  await test('users/{id} ドキュメント直下への書き込みが拒否される', () =>
    assertFails(setDoc(doc(db, 'users', USER_A), { profile: 'data' }))
  );
}

// ── 結果サマリー ────────────────────────────────────────────
await testEnv.cleanup();

console.log('\n' + '─'.repeat(40));
console.log(bold('結果:') + ` ${green(passed + ' 件成功')}, ${failed > 0 ? red(failed + ' 件失敗') : '0 件失敗'}`);
console.log('─'.repeat(40) + '\n');

if (failed > 0) process.exit(1);
