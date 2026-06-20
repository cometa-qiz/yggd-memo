'use client';

import { useState, useRef } from 'react';
import type { Note, Link } from '@/types';
import { NoteCard } from './NoteCard';
import { LinkLine } from './LinkLine';
import { CanvasControls } from './CanvasControls';

const CARD_CX = 100;
const CARD_CY = 40;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;

// ── ジェスチャー交差判定 ─────────────────────────────────────────

function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return false;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function gestureIntersectsLink(
  ax: number, ay: number, bx: number, by: number,
  x1: number, y1: number, x2: number, y2: number,
): boolean {
  const dxHalf = (x2 - x1) * 0.5;
  const cp1x = x1 + dxHalf, cp2x = x2 - dxHalf;
  const N = 20;
  let prevBx = x1, prevBy = y1;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const mt = 1 - t;
    const curBx = mt*mt*mt*x1 + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*x2;
    const curBy = mt*mt*mt*y1 + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y2;
    if (segmentsIntersect(ax, ay, bx, by, prevBx, prevBy, curBx, curBy)) return true;
    prevBx = curBx;
    prevBy = curBy;
  }
  return false;
}

// ── 型定義 ───────────────────────────────────────────────────────

type ConnectState = {
  fromId: string;
  cursorX: number;
  cursorY: number;
  targetId: string | null;
};

type CutLineState = { x1: number; y1: number; x2: number; y2: number };

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
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cutMode, setCutMode] = useState(false);
  const [cutLine, setCutLine] = useState<CutLineState | null>(null);
  const [panDragging, setPanDragging] = useState(false);

  const cutStateRef = useRef<{
    startX: number; startY: number;
    prevX: number; prevY: number;
    cutIds: Set<string>;
  } | null>(null);

  const panDragRef = useRef<{
    startPanX: number; startPanY: number;
    startPX: number; startPY: number;
  } | null>(null);

  const notesById = new Map(notes.map((n) => [n.id, n]));

  /** スクリーン座標（キャンバス相対）をノート座標系に変換 */
  function toNoteCoords(clientX: number, clientY: number, rect: DOMRect) {
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

  // ── 接続操作 ────────────────────────────────────────────────────

  function handleConnectStart(fromId: string) {
    if (cutMode) return;
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

  // ── キャンバスのポインターイベント ─────────────────────────────

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();

    if (cutMode) {
      const { x, y } = toNoteCoords(e.clientX, e.clientY, rect);
      e.currentTarget.setPointerCapture(e.pointerId);
      cutStateRef.current = { startX: x, startY: y, prevX: x, prevY: y, cutIds: new Set() };
      setCutLine({ x1: x, y1: y, x2: x, y2: y });
      return;
    }

    // NoteCard 以外の背景クリックならパン開始
    const target = e.target as Element;
    if (target.closest('[data-note-card]')) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    panDragRef.current = {
      startPanX: pan.x, startPanY: pan.y,
      startPX: e.clientX, startPY: e.clientY,
    };
    setPanDragging(true);
  }

  function handleCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();

    // 切るモード：ジェスチャー追跡
    if (cutMode) {
      const state = cutStateRef.current;
      if (!state) return;
      const { x, y } = toNoteCoords(e.clientX, e.clientY, rect);
      const { prevX, prevY, cutIds, startX, startY } = state;

      for (const link of links) {
        if (cutIds.has(link.id)) continue;
        const a = notesById.get(link.a);
        const b = notesById.get(link.b);
        if (!a || !b) continue;
        if (gestureIntersectsLink(prevX, prevY, x, y, a.x + CARD_CX, a.y + CARD_CY, b.x + CARD_CX, b.y + CARD_CY)) {
          cutIds.add(link.id);
          onRemoveLink(link.id).catch(console.error);
        }
      }

      state.prevX = x;
      state.prevY = y;
      setCutLine({ x1: startX, y1: startY, x2: x, y2: y });
      return;
    }

    // パンドラッグ
    const panDrag = panDragRef.current;
    if (panDrag) {
      const dx = e.clientX - panDrag.startPX;
      const dy = e.clientY - panDrag.startPY;
      setPan({ x: panDrag.startPanX + dx, y: panDrag.startPanY + dy });
      return;
    }

    // 接続カーソル追跡
    if (!connecting) return;
    const { x, y } = toNoteCoords(e.clientX, e.clientY, rect);
    setConnecting((prev) => prev ? { ...prev, cursorX: x, cursorY: y } : null);
  }

  async function handleCanvasPointerUp() {
    if (cutMode) {
      cutStateRef.current = null;
      setCutLine(null);
      return;
    }

    if (panDragRef.current) {
      panDragRef.current = null;
      setPanDragging(false);
      return;
    }

    if (!connecting) return;
    const { fromId, targetId } = connecting;
    setConnecting(null);
    if (targetId) await onAddLink(fromId, targetId);
  }

  function handleCanvasPointerLeave() {
    if (cutMode) {
      cutStateRef.current = null;
      setCutLine(null);
      return;
    }

    if (panDragRef.current) {
      panDragRef.current = null;
      setPanDragging(false);
      return;
    }

    if (connecting) setConnecting(null);
  }

  // ── 切る操作（チップ） ────────────────────────────────────────────

  async function handleCutLink(linkId: string) {
    await onRemoveLink(linkId);
    setSelectedLinkId(null);
  }

  function handleCanvasClick() {
    setSelectedLinkId(null);
  }

  // ── ズーム・パン操作 ─────────────────────────────────────────────

  function handleZoomIn() {
    setZoom((prev) => Math.min(MAX_ZOOM, parseFloat((prev + ZOOM_STEP).toFixed(2))));
  }

  function handleZoomOut() {
    setZoom((prev) => Math.max(MIN_ZOOM, parseFloat((prev - ZOOM_STEP).toFixed(2))));
  }

  function handleCenter() {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }

  function handleToggleCutMode() {
    setCutMode((prev) => {
      if (!prev) setConnecting(null);
      return !prev;
    });
  }

  // ── チップ位置（S字ベジェ中点 = 両端の算術平均） ───────────────

  const selectedLink = selectedLinkId ? links.find((l) => l.id === selectedLinkId) : null;
  const chipNote = selectedLink
    ? { a: notesById.get(selectedLink.a), b: notesById.get(selectedLink.b) }
    : null;
  const fromNote = connecting ? notesById.get(connecting.fromId) : undefined;

  return (
    <div
      className="relative flex-1 overflow-hidden bg-gray-50"
      style={{
        cursor: cutMode ? 'crosshair' : connecting ? 'crosshair' : panDragging ? 'grabbing' : 'grab',
        touchAction: cutMode || connecting || panDragging ? 'none' : 'none',
      }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerLeave={handleCanvasPointerLeave}
      onClick={handleCanvasClick}
    >
      {/* パン＋ズーム変換ラッパー（translate → scale の順：右から適用） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none"
          overflow="visible"
        >
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
          {connecting && fromNote && (
            <LinkLine
              x1={fromNote.x + CARD_CX}
              y1={fromNote.y + CARD_CY}
              x2={connecting.cursorX}
              y2={connecting.cursorY}
              dashed
            />
          )}
          {cutMode && cutLine && (
            <line
              x1={cutLine.x1} y1={cutLine.y1}
              x2={cutLine.x2} y2={cutLine.y2}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 2"
              strokeLinecap="round"
            />
          )}
        </svg>

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
            onPointerDown={(e) => e.stopPropagation()}
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
            zoom={zoom}
            cutMode={cutMode}
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

      <CanvasControls
        noteCount={notes.length}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenter={handleCenter}
        cutMode={cutMode}
        onToggleCutMode={handleToggleCutMode}
      />
    </div>
  );
}
