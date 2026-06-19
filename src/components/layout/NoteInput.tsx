'use client';

import { useState } from 'react';

type Props = {
  addNote: (text: string, x: number, y: number) => Promise<string>;
};

export function NoteInput({ addNote }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError('');
    try {
      await addNote(trimmed, 50, 50);
      setText('');
    } catch (e) {
      console.error('[NoteInput] addNote failed:', e);
      setError('メモの追加に失敗しました。再度お試しください。');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  return (
    <div className="flex flex-col gap-1 p-4">
      <div className="flex gap-2">
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
          disabled={!text.trim()}
          className="rounded bg-blue-500 px-4 py-2 text-white text-sm font-bold disabled:opacity-40 hover:bg-blue-600 active:bg-blue-700"
        >
          ＋
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
