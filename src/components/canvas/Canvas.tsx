'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Note, Link, BoardSkin } from '@/types';
import { NoteCard } from './NoteCard';
import { LinkLine } from './LinkLine';
import { CanvasControls } from './CanvasControls';

const CARD_CX = 100;
const CARD_CY = 40;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;
/** CSS transition 0.42s より少し長く追従し続ける（ms） */
const ANIM_DURATION_MS = 470;

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
  skin?: BoardSkin;
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
  onMove: (noteId: string, x: number, y: number) => Promise<void>;
  onAddLink: (a: string, b: string) => Promise<string>;
  onRemoveLink: (linkId: string) => Promise<void>;
};

const SKIN_CANVAS_BG: Record<BoardSkin, string> = {
  leaf:    'bg-green-50',
  default: 'bg-gray-50',
  cloud:   'bg-sky-50',
};

export function Canvas({ notes, links, skin = 'leaf', onEdit, onRemove, onMove, onAddLink, onRemoveLink }: Props) {
  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cutMode, setCutMode] = useState(false);
  const [cutLine, setCutLine] = useState<CutLineState | null>(null);
  const [panDragging, setPanDragging] = useState(false);

  /** rAF 追従中のカード中心座標（note 座標系）。アニメーション中のみ値が存在する */
  const [liveCardCenters, setLiveCardCenters] = useState<Map<string, { cx: number; cy: number }>>(
    () => new Map()
  );

  // ── refs ─────────────────────────────────────────────────────────

  const canvasRef = useRef<HTMLDivElement>(null);

  // ホイール・ピンチ処理でクロージャーの stale 値を避けるため ref に常時反映
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const cutStateRef = useRef<{
    startX: number; startY: number;
    prevX: number; prevY: number;
    cutIds: Set<string>;
  } | null>(null);

  const panDragRef = useRef<{
    startPanX: number; startPanY: number;
    startPX: number; startPY: number;
  } | null>(null);

  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
    midX: number;
    midY: number;
  } | null>(null);

  // ── カード DOM 要素管理（rAF 追従用） ────────────────────────────

  /** noteId → NoteCard 外側 div の DOM 要素（コールバック ref で格納） */
  const cardElMapRef = useRef<Map<string, HTMLDivElement | null>>(new Map());

  /** noteId → clip-path アニメーション終了予定時刻（performance.now ベース） */
  const animEndTimesRef = useRef<Map<string, number>>(new Map());
  /** 走行中の rAF ID（null = 停止中） */
  const rafIdRef = useRef<number | null>(null);
  /** scheduleTick 関数の安定参照（useCallback + useEffect で登録） */
  const scheduleTickRef = useRef<() => void>(null!);

  /**
   * rAF ループ本体。マウント時に scheduleTickRef へ登録する。
   * React の状態変化を経由せず DOM を直接読むため、
   * フレームレートに追従した滑らかな端点更新が可能。
   */
  useEffect(() => {
    scheduleTickRef.current = () => {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        const now = performance.now();
        const canvasRect = canvasEl.getBoundingClientRect();
        const px = panRef.current.x;
        const py = panRef.current.y;
        const z = zoomRef.current;

        const next = new Map<string, { cx: number; cy: number }>();
        let anyActive = false;

        for (const [noteId, endTime] of animEndTimesRef.current) {
          if (now <= endTime) {
            anyActive = true;
            const cardEl = cardElMapRef.current.get(noteId);
            if (cardEl) {
              const r = cardEl.getBoundingClientRect();
              // screen 座標 → note 座標系に変換
              next.set(noteId, {
                cx: (r.left + r.width  / 2 - canvasRect.left - px) / z,
                cy: (r.top  + r.height / 2 - canvasRect.top  - py) / z,
              });
            }
          } else {
            animEndTimesRef.current.delete(noteId);
          }
        }

        setLiveCardCenters(next);
        if (anyActive) scheduleTickRef.current();
      });
    };
  }, []); // マウント時のみ登録。参照するすべての値は ref か安定 setter

  /**
   * NoteCard から clip-path アニメーション開始の通知を受け rAF ループを起動する。
   * useCallback で安定化し、performance.now() をレンダー外で呼び出す。
   */
  const handleExpandChange = useCallback((noteId: string) => {
    animEndTimesRef.current.set(noteId, performance.now() + ANIM_DURATION_MS);
    if (rafIdRef.current === null) {
      scheduleTickRef.current();
    }
  }, []);

  // ── ホイールズーム（passive: false が必要なため命令的に追加） ──

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const curZoom = zoomRef.current;
      const curPan = panRef.current;

      // 指数スケールでスムーズなズーム（マウスホイール・トラックパッド両対応）
      const factor = Math.exp(-e.deltaY * 0.001);
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parseFloat((curZoom * factor).toFixed(3))));
      const scale = newZoom / curZoom;

      // カーソル位置を固定したままパンを補正
      setZoom(newZoom);
      setPan({ x: cx - (cx - curPan.x) * scale, y: cy - (cy - curPan.y) * scale });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // マウント時のみ。zoom/pan は ref 経由で参照

  // ── ピンチズーム（touch イベント） ───────────────────────────────

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 2) {
      pinchRef.current = null;
      return;
    }
    // 2本指検出: パンドラッグを中断してピンチ開始
    if (panDragRef.current) {
      panDragRef.current = null;
      setPanDragging(false);
    }
    const [t1, t2] = [e.touches[0], e.touches[1]];
    const rect = e.currentTarget.getBoundingClientRect();
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
    const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
    pinchRef.current = {
      startDist: dist,
      startZoom: zoomRef.current,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      midX,
      midY,
    };
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const pinch = pinchRef.current;
    if (!pinch || e.touches.length !== 2) return;

    const [t1, t2] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.startZoom * (dist / pinch.startDist)));
    const scale = newZoom / pinch.startZoom;

    // ピンチ中心点（画面上）を固定してパン補正
    const { midX, midY, startPanX, startPanY } = pinch;
    setZoom(parseFloat(newZoom.toFixed(3)));
    setPan({ x: midX - (midX - startPanX) * scale, y: midY - (midY - startPanY) * scale });
  }

  function handleTouchEnd() {
    pinchRef.current = null;
  }

  // ── 接続操作 ────────────────────────────────────────────────────

  const notesById = new Map(notes.map((n) => [n.id, n]));

  function toNoteCoords(clientX: number, clientY: number, rect: DOMRect) {
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

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
    // ピンチ中はポインターイベントを無視（touch イベントが主導）
    if (pinchRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();

    if (cutMode) {
      const { x, y } = toNoteCoords(e.clientX, e.clientY, rect);
      e.currentTarget.setPointerCapture(e.pointerId);
      cutStateRef.current = { startX: x, startY: y, prevX: x, prevY: y, cutIds: new Set() };
      setCutLine({ x1: x, y1: y, x2: x, y2: y });
      return;
    }

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
    if (pinchRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();

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

    const panDrag = panDragRef.current;
    if (panDrag) {
      setPan({ x: panDrag.startPanX + (e.clientX - panDrag.startPX), y: panDrag.startPanY + (e.clientY - panDrag.startPY) });
      return;
    }

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

  // ── ズーム・パン操作（ボタン） ───────────────────────────────────

  function handleZoomIn() {
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, parseFloat((prev + ZOOM_STEP).toFixed(2)));
      // 画面中心を固定してパン補正
      const el = canvasRef.current;
      if (el) {
        const cx = el.clientWidth / 2;
        const cy = el.clientHeight / 2;
        const scale = next / prev;
        setPan((p) => ({ x: cx - (cx - p.x) * scale, y: cy - (cy - p.y) * scale }));
      }
      return next;
    });
  }

  function handleZoomOut() {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, parseFloat((prev - ZOOM_STEP).toFixed(2)));
      const el = canvasRef.current;
      if (el) {
        const cx = el.clientWidth / 2;
        const cy = el.clientHeight / 2;
        const scale = next / prev;
        setPan((p) => ({ x: cx - (cx - p.x) * scale, y: cy - (cy - p.y) * scale }));
      }
      return next;
    });
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
      ref={canvasRef}
      className={`relative flex-1 overflow-hidden ${SKIN_CANVAS_BG[skin]}`}
      style={{
        cursor: cutMode ? 'crosshair' : connecting ? 'crosshair' : panDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerLeave={handleCanvasPointerLeave}
      onClick={handleCanvasClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* パン＋ズーム変換ラッパー */}
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
            // アニメーション追従中は rAF で更新した実座標を使い、
            // それ以外は静的オフセットにフォールバックする
            const ac = liveCardCenters.get(link.a);
            const bc = liveCardCenters.get(link.b);
            return (
              <LinkLine
                key={link.id}
                x1={ac?.cx ?? a.x + CARD_CX}
                y1={ac?.cy ?? a.y + CARD_CY}
                x2={bc?.cx ?? b.x + CARD_CX}
                y2={bc?.cy ?? b.y + CARD_CY}
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
            ref={(el) => { cardElMapRef.current.set(note.id, el); }}
            note={note}
            skin={skin}
            zoom={zoom}
            cutMode={cutMode}
            onEdit={onEdit}
            onRemove={onRemove}
            onMove={onMove}
            onConnectStart={handleConnectStart}
            onConnectEnter={handleConnectEnter}
            onConnectLeave={handleConnectLeave}
            isConnectTarget={connecting?.targetId === note.id}
            onExpandChange={handleExpandChange}
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
