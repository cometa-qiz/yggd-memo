'use client';

import { useState } from 'react';
import type { Note, Link } from '@/types';
import { NoteCard } from './NoteCard';
import { LinkLine } from './LinkLine';

const CARD_CX = 100;
const CARD_CY = 40;

type ConnectState = {
  fromId: string;
  cursorX: number;
  cursorY: number;
  targetId: string | null;
};

type Props = {
  notes: Note[];
  links: Link[];
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
  onMove: (noteId: string, x: number, y: number) => Promise<void>;
  onAddLink: (a: string, b: string) => Promise<string>;
  onRemoveLink: (linkId: string) => Promise<void>;
};

export function Canvas({ notes, links, onEdit, onRemove, onMove, onAddLink, onRemoveLink }: Props) {
  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const notesById = new Map(notes.map((n) => [n.id, n]));

  // ── 接続操作 ────────────────────────────────────────────────────

  function handleConnectStart(fromId: string) {
    const note = notesById.get(fromId);
    if (!note) return;
    setSelectedLinkId(null);
    setConnecting({ fromId, cursorX: note.x + CARD_CX, cursorY: note.y + CARD_CY, targetId: null });
  }

  function handleConnectEnter(noteId: string) {
    if (!connecting || noteId === connecting.fromId) return;
    setConnecting((prev) => (prev ? { ...prev, targetId: noteId } : null));
  }

  function handleConnectLeave(noteId: string) {
    setConnecting((prev) => {
      if (!prev || prev.targetId !== noteId) return prev;
      return { ...prev, targetId: null };
    });
  }

  function handleCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!connecting) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setConnecting((prev) =>
      prev ? { ...prev, cursorX: e.clientX - rect.left, cursorY: e.clientY - rect.top } : null,
    );
  }

  async function handleCanvasPointerUp() {
    if (!connecting) return;
    const { fromId, targetId } = connecting;
    setConnecting(null);
    if (targetId) {
      await onAddLink(fromId, targetId);
    }
  }

  function handleCanvasPointerLeave() {
    if (connecting) setConnecting(null);
  }

  // ── 切る操作 ─────────────────────────────────────────────────────

  async function handleCutLink(linkId: string) {
    await onRemoveLink(linkId);
    setSelectedLinkId(null);
  }

  // キャンバス背景クリックで選択解除（NoteCard と確定線は自身で stopPropagation）
  function handleCanvasClick() {
    setSelectedLinkId(null);
  }

  // ── チップ位置計算（ベジェ曲線中点 = 両端の算術平均） ─────────

  const selectedLink = selectedLinkId ? links.find((l) => l.id === selectedLinkId) : null;
  const chipNote = selectedLink
    ? { a: notesById.get(selectedLink.a), b: notesById.get(selectedLink.b) }
    : null;
  const fromNote = connecting ? notesById.get(connecting.fromId) : undefined;

  return (
    <div
      className="relative flex-1 overflow-hidden bg-gray-50"
      style={{
        cursor: connecting ? 'crosshair' : undefined,
        touchAction: connecting ? 'none' : undefined,
      }}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerLeave={handleCanvasPointerLeave}
      onClick={handleCanvasClick}
    >
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        overflow="visible"
      >
        {/* 確定済みのつながり */}
        {links.map((link) => {
          const a = notesById.get(link.a);
          const b = notesById.get(link.b);
          if (!a || !b) return null;
          return (
            <LinkLine
              key={link.id}
              x1={a.x + CARD_CX}
              y1={a.y + CARD_CY}
              x2={b.x + CARD_CX}
              y2={b.y + CARD_CY}
              selected={selectedLinkId === link.id}
              onSelect={() => setSelectedLinkId(link.id)}
            />
          );
        })}
        {/* 接続プレビュー線（破線） */}
        {connecting && fromNote && (
          <LinkLine
            x1={fromNote.x + CARD_CX}
            y1={fromNote.y + CARD_CY}
            x2={connecting.cursorX}
            y2={connecting.cursorY}
            dashed
          />
        )}
      </svg>

      {/* 「✕ 切る」チップ：選択された線の中点に表示 */}
      {chipNote?.a && chipNote?.b && (
        <button
          style={{
            position: 'absolute',
            left: (chipNote.a.x + CARD_CX + chipNote.b.x + CARD_CX) / 2,
            top: (chipNote.a.y + CARD_CY + chipNote.b.y + CARD_CY) / 2,
            transform: 'translate(-50%, -50%)',
            zIndex: 20,
          }}
          className="flex items-center gap-1 rounded-full border border-red-200 bg-white px-2 py-1 text-xs text-red-500 shadow-lg hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            handleCutLink(selectedLinkId!);
          }}
        >
          ✕ 切る
        </button>
      )}

      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onEdit={onEdit}
          onRemove={onRemove}
          onMove={onMove}
          onConnectStart={handleConnectStart}
          onConnectEnter={handleConnectEnter}
          onConnectLeave={handleConnectLeave}
          isConnectTarget={connecting?.targetId === note.id}
        />
      ))}
    </div>
  );
}
