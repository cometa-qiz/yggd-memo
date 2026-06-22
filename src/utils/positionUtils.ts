import type { Note } from '@/types';

// ドラッグ衝突判定に使うカードの保守的なサイズ（max-w[200px] + ギャップ）
const CARD_W = 220;
const CARD_H = 100;

function overlapsAny(x: number, y: number, notes: Note[], excludeId?: string): boolean {
  return notes.some((n) => {
    if (excludeId !== undefined && n.id === excludeId) return false;
    return !(
      x + CARD_W <= n.x ||
      n.x + CARD_W <= x ||
      y + CARD_H <= n.y ||
      n.y + CARD_H <= y
    );
  });
}

/**
 * 指定座標から最も近い空きスペースをスパイラル探索で返す。
 * excludeId: ドラッグ中のメモ自身を除外するために指定する。
 */
export function findEmptyPosition(
  desiredX: number,
  desiredY: number,
  notes: Note[],
  excludeId?: string
): { x: number; y: number } {
  if (!overlapsAny(desiredX, desiredY, notes, excludeId)) {
    return { x: desiredX, y: desiredY };
  }

  for (let ring = 1; ring <= 20; ring++) {
    // 上端・下端の行
    for (let col = -ring; col <= ring; col++) {
      for (const row of [-ring, ring]) {
        const cx = desiredX + col * CARD_W;
        const cy = desiredY + row * CARD_H;
        if (cx >= 0 && cy >= 0 && !overlapsAny(cx, cy, notes, excludeId)) {
          return { x: cx, y: cy };
        }
      }
    }
    // 左端・右端の列（角は上でチェック済みなので除外）
    for (let row = -ring + 1; row <= ring - 1; row++) {
      for (const col of [-ring, ring]) {
        const cx = desiredX + col * CARD_W;
        const cy = desiredY + row * CARD_H;
        if (cx >= 0 && cy >= 0 && !overlapsAny(cx, cy, notes, excludeId)) {
          return { x: cx, y: cy };
        }
      }
    }
  }

  return { x: desiredX, y: desiredY };
}
