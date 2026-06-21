'use client';

import { useBoardsContext } from '@/contexts/BoardsContext';
import type { BoardSkin } from '@/types';

const SKINS: { id: BoardSkin; label: string; clipPath: string }[] = [
  {
    id: 'leaf',
    label: '葉っぱ',
    // globals.css の .clip-leaf と同一の多角形
    clipPath:
      'polygon(35% 2%, 50% 0%, 65% 2%, 90% 20%, 100% 50%, 90% 80%, 65% 98%, 50% 100%, 35% 98%, 10% 80%, 0% 50%, 10% 20%)',
  },
  {
    id: 'default',
    label: 'デフォルト',
    // globals.css の .clip-rounded-rect と同一の多角形
    clipPath:
      'polygon(10% 0%, 50% 0%, 90% 0%, 100% 10%, 100% 50%, 100% 90%, 90% 100%, 50% 100%, 10% 100%, 0% 90%, 0% 50%, 0% 10%)',
  },
  {
    id: 'cloud',
    label: '雲',
    // 上辺が膨らんだ雲形ポリゴン（.clip-leaf と同じ12点）
    clipPath:
      'polygon(30% 0%, 50% 8%, 70% 0%, 92% 18%, 100% 50%, 92% 82%, 70% 100%, 50% 92%, 30% 100%, 8% 82%, 0% 50%, 8% 18%)',
  },
];

export function SkinSelector() {
  const { currentBoard, changeBoardSkin } = useBoardsContext();

  if (!currentBoard) return null;

  const current = currentBoard.skin;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
        スキン
      </h2>

      <div className="flex gap-3">
        {SKINS.map(({ id, label, clipPath }) => {
          const selected = current === id;
          return (
            <button
              key={id}
              onClick={() => changeBoardSkin(currentBoard.id, id)}
              className={[
                'flex flex-col items-center gap-2 flex-1 py-3 rounded-xl border transition-colors',
                selected
                  ? 'border-zinc-800 bg-zinc-50'
                  : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50',
              ].join(' ')}
              aria-label={`スキンを ${label} に変更`}
              aria-pressed={selected}
            >
              {/* カード形プレビュー */}
              <span
                className="block w-8 h-8 bg-zinc-800"
                style={{ clipPath }}
                aria-hidden
              />
              <span
                className={[
                  'text-xs',
                  selected ? 'text-zinc-800 font-semibold' : 'text-zinc-500',
                ].join(' ')}
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
