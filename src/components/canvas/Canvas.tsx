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
};

export function Canvas({ notes, links, onEdit, onRemove, onMove, onAddLink }: Props) {
  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const notesById = new Map(notes.map((n) => [n.id, n]));

  // ハンドルドラッグ開始
  function handleConnectStart(fromId: string) {
    const note = notesById.get(fromId);
    if (!note) return;
    setConnecting({
      fromId,
      cursorX: note.x + CARD_CX,
      cursorY: note.y + CARD_CY,
      targetId: null,
    });
  }

  // 接続候補カードに入った
  function handleConnectEnter(noteId: string) {
    if (!connecting || noteId === connecting.fromId) return;
    setConnecting((prev) => (prev ? { ...prev, targetId: noteId } : null));
  }

  // 接続候補カードから出た
  function handleConnectLeave(noteId: string) {
    setConnecting((prev) => {
      if (!prev || prev.targetId !== noteId) return prev;
      return { ...prev, targetId: null };
    });
  }

  // カーソル位置を Canvas 座標系で追跡
  function handleCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!connecting) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setConnecting((prev) =>
      prev
        ? { ...prev, cursorX: e.clientX - rect.left, cursorY: e.clientY - rect.top }
        : null,
    );
  }

  // ポインターアップで接続を確定
  async function handleCanvasPointerUp() {
    if (!connecting) return;
    const { fromId, targetId } = connecting;
    setConnecting(null);
    if (targetId) {
      await onAddLink(fromId, targetId);
    }
  }

  // キャンバス外へ出たら接続キャンセル
  function handleCanvasPointerLeave() {
    if (connecting) setConnecting(null);
  }

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
