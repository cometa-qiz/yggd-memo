'use client';

import { useBoardsContext } from '@/contexts/BoardsContext';
import type { BoardSkin } from '@/types';

// globals.css の 27点ポリゴンと同一値（CSS transition で補間できる点数を揃えている）
const LEAF_CLIP =
  'polygon(99.5% 1.7%, 96.9% 1.1%, 90.6% 6.0%, 81.1% 7.9%, 51.8% 0.4%, 40.8% 0.0%, 32.4% 2.1%, 23.9% 8.4%, 16.8% 18.3%, 10.5% 34.4%, 7.2% 52.8%, 6.3% 72.5%, 4.7% 79.2%, 0.5% 88.1%, 0.6% 95.0%, 2.8% 96.7%, 7.1% 87.7%, 12.1% 84.7%, 36.0% 96.6%, 49.1% 99.9%, 59.7% 98.3%, 71.5% 90.3%, 77.2% 83.3%, 83.9% 71.8%, 90.9% 54.3%, 97.8% 25.5%, 99.9% 8.6%)';

const RECT_CLIP =
  'polygon(88.0% 0.0%, 84.1% 0.0%, 76.4% 0.0%, 64.8% 0.0%, 32.6% 0.0%, 21.0% 0.0%, 12.0% 0.0%, 2.1% 5.2%, 0.0% 18.4%, 0.0% 36.5%, 0.0% 57.1%, 0.0% 79.0%, 0.0% 85.4%, 2.7% 95.6%, 9.1% 99.7%, 12.0% 100.0%, 23.6% 100.0%, 30.0% 100.0%, 58.4% 100.0%, 72.5% 100.0%, 84.1% 100.0%, 97.9% 94.8%, 100.0% 85.4%, 100.0% 71.3%, 100.0% 50.6%, 100.0% 18.4%, 94.8% 2.1%)';

const CLOUD_CLIP =
  'polygon(71.0% 9.2%, 66.0% 4.7%, 60.5% 3.2%, 49.5% 7.6%, 43.4% 1.6%, 37.8% 0.0%, 28.3% 4.7%, 21.5% 16.1%, 18.3% 26.9%, 13.3% 28.5%, 7.9% 34.8%, 3.5% 47.5%, 2.3% 60.8%, 0.0% 68.7%, 0.6% 74.4%, 2.9% 79.7%, 13.3% 91.8%, 45.1% 99.7%, 63.1% 98.7%, 82.1% 92.7%, 94.6% 83.2%, 98.2% 77.5%, 99.8% 70.6%, 93.0% 39.2%, 86.8% 30.4%, 79.3% 28.8%, 76.2% 18.7%)';

const SKINS: { id: BoardSkin; label: string; clipPath: string }[] = [
  { id: 'leaf',    label: '葉っぱ',     clipPath: LEAF_CLIP },
  { id: 'default', label: 'デフォルト', clipPath: RECT_CLIP },
  { id: 'cloud',   label: '雲',         clipPath: CLOUD_CLIP },
];

export function SkinSelector() {
  const { currentBoard, changeBoardSkin } = useBoardsContext();

  if (!currentBoard) return null;

  const current = currentBoard.skin;

  return (
    <section className="space-y-4">
      <h2
        className="text-sm font-semibold uppercase tracking-wide"
        style={{ color: 'var(--ink-soft)' }}
      >
        スキン
      </h2>

      <div className="flex gap-3">
        {SKINS.map(({ id, label, clipPath }) => {
          const selected = current === id;
          return (
            <button
              key={id}
              onClick={() => changeBoardSkin(currentBoard.id, id)}
              className="flex flex-col items-center gap-2 flex-1 py-3 rounded-xl transition-colors"
              style={{
                background: selected ? 'rgba(var(--accent-rgb), 0.12)' : 'var(--paper)',
                border: selected ? '1px solid var(--dusk)' : '1px solid var(--line)',
              }}
              aria-label={`スキンを ${label} に変更`}
              aria-pressed={selected}
            >
              {/* 実際のカード形状でプレビュー */}
              <span
                className="block"
                style={{
                  width: '44px',
                  height: '44px',
                  background: selected ? 'var(--dusk)' : 'var(--ink-soft)',
                  clipPath,
                  transition: 'background 0.2s ease, clip-path 0.3s ease',
                }}
                aria-hidden
              />
              <span
                className="text-xs"
                style={{
                  color: selected ? 'var(--dusk)' : 'var(--ink-soft)',
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
