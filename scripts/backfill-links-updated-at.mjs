/**
 * isActive:false な links のうち、updatedAt が欠落しているドキュメントに
 * updatedAt = createdAt をバックフィルする（一度きりのデータ修復用）。
 *
 * design-review_2026-07.md R4-4 対応。
 * updatedAt は R1-1（2026-07-07）で links に追加されたフィールドのため、
 * それ以前に論理削除されたまま一度も更新されていないドキュメントに欠落している。
 * cleanup-soft-deleted.mjs は updatedAt が無いドキュメントを安全側に倒して
 * 削除対象から除外するため、欠落したままだと30日retentionの物理削除が
 * 永久に効かない。「最終更新時刻」の実データが無いため、代替値として
 * createdAt をそのままコピーする。
 *
 * 対象は isActive:false のみ（isActive:true は deactivateLink 実行時に
 * updatedAt が自動付与されるため対応不要。scripts/check-links-updated-at.mjs
 * の集計結果・調査メモを参照）。
 *
 * ⚠️ 本スクリプトは updatedAt フィールドのみを書き換える。isActive・a・b等の
 *    他フィールドやドキュメント自体には一切触れない（物理削除は行わない）。
 * ⚠️ バックフィル後、本スクリプトの実行だけでは cleanup-soft-deleted.mjs は
 *    実行されない。物理削除を伴うクリーンアップは別途手動で判断すること。
 *
 * 使い方:
 *   node scripts/backfill-links-updated-at.mjs --dry-run   # 対象件数・一覧の確認のみ（書き込みなし）
 *   node scripts/backfill-links-updated-at.mjs             # 実際に updatedAt を書き込む
 *
 * 前提: プロジェクトルートに serviceAccountKey.json を配置しておくこと。
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, '..', 'serviceAccountKey.json');
const dryRun = process.argv.includes('--dry-run');
const BATCH_LIMIT = 400; // Admin SDK の batch 上限500に対して余裕を持たせる

if (!existsSync(keyPath)) {
  console.error(`✗ サービスアカウントキーが見つかりません: ${keyPath}`);
  console.error('  入手方法は scripts/cleanup-soft-deleted.mjs 末尾のコメントを参照してください。');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

async function main() {
  console.log(`\n▶ links(isActive:false)のupdatedAtバックフィル${dryRun ? '（--dry-run: 対象確認のみ、書き込みなし）' : ''}\n`);

  let snap;
  try {
    snap = await db.collectionGroup('links').where('isActive', '==', false).get();
  } catch (err) {
    if (err.code === 9 /* FAILED_PRECONDITION */) {
      console.error('✗ collection group クエリに必要なインデックスがありません。');
      console.error('  エラーメッセージ中のURLをブラウザで開き、インデックスを作成してから再実行してください:\n');
      console.error('  ' + err.message + '\n');
      process.exit(1);
    }
    throw err;
  }

  const targets = snap.docs.filter((d) => !d.data().updatedAt && d.data().createdAt);
  const missingCreatedAtToo = snap.docs.filter((d) => !d.data().updatedAt && !d.data().createdAt);

  console.log(`isActive:false な links 総数: ${snap.docs.length}件`);
  console.log(`バックフィル対象（updatedAt欠落・createdAtあり）: ${targets.length}件`);
  if (missingCreatedAtToo.length > 0) {
    console.log(`⚠ createdAtも欠落しておりスキップ: ${missingCreatedAtToo.length}件`);
    missingCreatedAtToo.forEach((d) => console.log(`  - ${d.ref.path}`));
  }

  console.log(`\n対象一覧（updatedAt ← createdAt）:`);
  targets.forEach((d) => {
    console.log(`  - ${d.ref.path}  (createdAt: ${d.data().createdAt.toDate().toISOString()})`);
  });

  if (dryRun) {
    console.log('\n※ --dry-run のため実際の書き込みは行われていません。');
    console.log('');
    return;
  }

  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const chunk = targets.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((d) => batch.update(d.ref, { updatedAt: d.data().createdAt }));
    await batch.commit();
  }

  console.log(`\n✓ ${targets.length}件に updatedAt を書き込みました。`);
  console.log('');
}

main().catch((err) => {
  console.error('\nスクリプト実行中にエラーが発生しました:', err);
  process.exit(1);
});
