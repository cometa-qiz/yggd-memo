/**
 * links コレクションの全ドキュメントを横断的に確認し、updatedAt フィールドが
 * 欠落しているドキュメントの件数を集計する（読み取り専用）。
 *
 * design-review_2026-07.md R4-4 対応。
 * updatedAt は R1-1（2026-07-07）で links に追加されたフィールドのため、
 * それ以前に作成されたまま一度も更新されていない古いドキュメントには
 * 欠落している可能性がある。cleanup-soft-deleted.mjs は updatedAt が無い
 * ドキュメントを安全側に倒して削除対象から除外するため、欠落したままだと
 * 論理削除から30日経過しても物理削除の対象にならない。
 *
 * ⚠️ 本スクリプトは読み取りのみ。書き込み・削除は一切行わない。
 *
 * 使い方:
 *   node scripts/check-links-updated-at.mjs
 *
 * 前提: プロジェクトルートに serviceAccountKey.json を配置しておくこと
 *       （入手方法は scripts/cleanup-soft-deleted.mjs 末尾のコメントを参照）。
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, '..', 'serviceAccountKey.json');

if (!existsSync(keyPath)) {
  console.error(`✗ サービスアカウントキーが見つかりません: ${keyPath}`);
  console.error('  入手方法は scripts/cleanup-soft-deleted.mjs 末尾のコメントを参照してください。');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

async function main() {
  console.log('\n▶ links コレクションの updatedAt 欠落確認（読み取り専用・削除や書き込みは一切行いません）\n');

  let snap;
  try {
    snap = await db.collectionGroup('links').get();
  } catch (err) {
    if (err.code === 9 /* FAILED_PRECONDITION */) {
      console.error('✗ collection group クエリに必要なインデックスがありません。');
      console.error('  エラーメッセージ中のURLをブラウザで開き、インデックスを作成してから再実行してください:\n');
      console.error('  ' + err.message + '\n');
      process.exit(1);
    }
    throw err;
  }

  const total = snap.docs.length;
  const missing = snap.docs.filter((d) => !d.data().updatedAt);
  const missingActive = missing.filter((d) => d.data().isActive === true);
  const missingInactive = missing.filter((d) => d.data().isActive === false);

  console.log(`links 総数            : ${total}件`);
  console.log(`updatedAt 欠落        : ${missing.length}件`);
  console.log(`  └ isActive:true     : ${missingActive.length}件`);
  console.log(`  └ isActive:false    : ${missingInactive.length}件`);

  if (missing.length > 0) {
    const sampleSize = Math.min(20, missing.length);
    console.log(`\n欠落ドキュメントの例（先頭${sampleSize}件、path）:`);
    missing.slice(0, sampleSize).forEach((d) => console.log(`  - ${d.ref.path}`));
    if (missing.length > sampleSize) {
      console.log(`  ...ほか${missing.length - sampleSize}件`);
    }
  }

  console.log('');
}

main().catch((err) => {
  console.error('\nスクリプト実行中にエラーが発生しました:', err);
  process.exit(1);
});
