/**
 * 論理削除（isActive: false）から一定期間経過したドキュメントを物理削除する。
 *
 * 手動実行専用（Cloud Functions化・スケジューラ化はしない方針。design-review R1-1）。
 *
 * ⚠️ 実行前に必ず、設定画面の「全ボードの書き出し」（R2-6）でCSV/JSONバックアップを
 *    取得しておくこと。本スクリプトは物理削除であり、実行後のデータ復元はできない。
 *
 * 使い方:
 *   node scripts/cleanup-soft-deleted.mjs --dry-run   # 削除対象件数だけ確認（実削除なし）
 *   node scripts/cleanup-soft-deleted.mjs             # 実際に物理削除する
 *
 * 前提: プロジェクトルートに serviceAccountKey.json を配置しておくこと。
 *       入手方法はこのファイル末尾のコメントを参照。
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, '..', 'serviceAccountKey.json');
const dryRun = process.argv.includes('--dry-run');
const RETENTION_DAYS = 30;
const BATCH_LIMIT = 400; // Admin SDK の batch 上限500に対して余裕を持たせる

if (!existsSync(keyPath)) {
  console.error(`✗ サービスアカウントキーが見つかりません: ${keyPath}`);
  console.error('  入手方法はこのファイル末尾のコメントを参照してください。');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

const cutoffMillis = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

function isExpired(data) {
  // boards / notes / links はすべて updatedAt を持つ（links は本対応で追加済み）
  const ts = data.updatedAt;
  if (!ts) return false; // 想定外に欠けている場合は安全側に倒し削除対象にしない
  return ts.toMillis() < cutoffMillis;
}

/** isActive:false なドキュメントを collectionGroup で横断取得する */
async function fetchInactive(collectionName) {
  try {
    const snap = await db.collectionGroup(collectionName).where('isActive', '==', false).get();
    return snap.docs;
  } catch (err) {
    if (err.code === 9 /* FAILED_PRECONDITION */) {
      console.error(`\n✗ ${collectionName}: collection group クエリに必要なインデックスがありません。`);
      console.error('  エラーメッセージ中のURLをブラウザで開き、インデックスを作成してから再実行してください（一度だけ必要）:\n');
      console.error('  ' + err.message + '\n');
      process.exit(1);
    }
    throw err;
  }
}

/** 参照の配列を500件ずつのバッチに分けて削除する（--dry-runなら数えるだけ） */
async function deleteRefs(refs, label) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const chunk = refs.slice(i, i + BATCH_LIMIT);
    if (!dryRun) {
      const batch = db.batch();
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }
  console.log(`  ${label}: ${refs.length}件${dryRun ? '（--dry-run、実削除なし）' : 'を物理削除しました'}`);
  return refs.length;
}

async function main() {
  console.log(`\n▶ 論理削除データの物理削除${dryRun ? '（--dry-run: 件数確認のみ）' : ''}`);
  console.log(`  保持期間: ${RETENTION_DAYS}日 / 基準日時: ${new Date(cutoffMillis).toISOString()}\n`);

  // 1. 期限切れボード。孤児化防止のため、配下の notes / links は経過日数を問わず道連れで物理削除する
  const inactiveBoards = await fetchInactive('boards');
  const expiredBoards = inactiveBoards.filter((d) => isExpired(d.data()));
  const purgedBoardPaths = new Set(expiredBoards.map((d) => d.ref.path));

  let cascadedNotes = 0;
  let cascadedLinks = 0;
  for (const boardDoc of expiredBoards) {
    const [notesSnap, linksSnap] = await Promise.all([
      boardDoc.ref.collection('notes').get(),
      boardDoc.ref.collection('links').get(),
    ]);
    cascadedNotes += await deleteRefs(
      notesSnap.docs.map((d) => d.ref),
      `  └ ${boardDoc.ref.path} 配下の notes`
    );
    cascadedLinks += await deleteRefs(
      linksSnap.docs.map((d) => d.ref),
      `  └ ${boardDoc.ref.path} 配下の links`
    );
  }
  const deletedBoards = await deleteRefs(expiredBoards.map((d) => d.ref), 'boards（期限切れ）');

  // 2. 個別に期限切れの notes / links（親ボードはまだアクティブなもの）
  //    親ボードごとカスケード削除済みの分は、ここでは自然に対象外になる
  const inactiveNotes = await fetchInactive('notes');
  const expiredNotes = inactiveNotes
    .filter((d) => isExpired(d.data()))
    .filter((d) => !purgedBoardPaths.has(d.ref.parent.parent.path));

  const inactiveLinks = await fetchInactive('links');
  const expiredLinks = inactiveLinks
    .filter((d) => isExpired(d.data()))
    .filter((d) => !purgedBoardPaths.has(d.ref.parent.parent.path));

  const deletedNotes = await deleteRefs(expiredNotes.map((d) => d.ref), 'notes（個別・期限切れ）');
  const deletedLinks = await deleteRefs(expiredLinks.map((d) => d.ref), 'links（個別・期限切れ）');

  console.log('\n' + '─'.repeat(40));
  console.log('集計:');
  console.log(`  boards             : ${deletedBoards}件`);
  console.log(`  notes（カスケード） : ${cascadedNotes}件`);
  console.log(`  links（カスケード） : ${cascadedLinks}件`);
  console.log(`  notes（個別）       : ${deletedNotes}件`);
  console.log(`  links（個別）       : ${deletedLinks}件`);
  console.log('─'.repeat(40));
  if (dryRun) {
    console.log('\n※ --dry-run のため実際の削除は行われていません。');
  }
  console.log('');
}

main().catch((err) => {
  console.error('\nスクリプト実行中にエラーが発生しました:', err);
  process.exit(1);
});

// =============================================================
// サービスアカウントキーの入手方法:
//   1. Firebaseコンソール ( https://console.firebase.google.com/ ) を開く
//   2. プロジェクト「yggd-memo」を選択
//   3. 左上の歯車アイコン →「プロジェクトの設定」
//   4.「サービス アカウント」タブ →「新しい秘密鍵の生成」
//   5. ダウンロードされたJSONファイルをプロジェクトルートに
//      `serviceAccountKey.json` というファイル名で保存する
//
// 注意:
//   - このキーはプロジェクトへの管理者権限（Admin SDK）を持つ強力な認証情報です。
//     絶対にGitにコミットしない・他人と共有しないこと。
//   - .gitignore に `serviceAccountKey.json` を追加済み（このコミットで対応）。
//   - 誤って公開してしまった場合は、Firebaseコンソールの
//     「サービス アカウント」タブから該当キーを無効化し、新しいキーを再発行すること。
// =============================================================
