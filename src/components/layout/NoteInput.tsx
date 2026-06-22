'use client';

import { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';

type Props = {
  addNote: (text: string, x: number, y: number) => Promise<string>;
  disabled?: boolean;
};

export function NoteInput({ addNote, disabled = false }: Props) {
  const [text, setText] = useState('');
  const showToast = useToast();

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await addNote(trimmed, 50, 50);
      setText('');
    } catch (e) {
      console.error('[NoteInput] addNote failed:', e);
      showToast('メモの追加に失敗しました。再度お試しください。');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  return (
    <div className="flex gap-2 p-4">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="思いついたことをメモする..."
        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        onClick={handleAdd}
        disabled={disabled || !text.trim()}
        className="rounded bg-blue-500 px-4 py-2 text-white text-sm font-bold disabled:opacity-40 hover:bg-blue-600 active:bg-blue-700"
      >
        ＋
      </button>
    </div>
  );
}
