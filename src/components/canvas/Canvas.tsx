'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Note, Link, BoardSkin } from '@/types';
import { NoteCard } from './NoteCard';
import { LinkLine } from './LinkLine';
import { CanvasControls } from './CanvasControls';
import type { CanvasView } from '@/hooks/useCanvasView';
import { useToast } from '@/contexts/ToastContext';

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

// 点 (px,py) から線分 (ax,ay)-(bx,by) への距離の二乗
function distPointToSegmentSq(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - ax, ey = py - ay;
    return ex * ex + ey * ey;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  const ex = px - cx, ey = py - cy;
  return ex * ex + ey * ey;
}

// 2本の線分間の最小距離の二乗（4端点それぞれの相手線分への距離の最小値で近似）
// 平行・コリニアな線分でも正しく近接を判定できる
function minSegDistSq(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): number {
  return Math.min(
    distPointToSegmentSq(ax, ay, cx, cy, dx, dy),
    distPointToSegmentSq(bx, by, cx, cy, dx, dy),
    distPointToSegmentSq(cx, cy, ax, ay, bx, by),
    distPointToSegmentSq(dx, dy, ax, ay, bx, by),
  );
}

function gestureIntersectsLink(
  ax: number, ay: number, bx: number, by: number,
  x1: number, y1: number, x2: number, y2: number,
): boolean {
  // ±10 note-space 単位以内の通過を切断と判定
  // segmentsIntersect は平行線分（denom≈0）で false を返すため、
  // minSegDistSq で4端点すべての近接を補完する
  const CUT_DIST_SQ = 10 * 10;
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
    if (minSegDistSq(ax, ay, bx, by, prevBx, prevBy, curBx, curBy) < CUT_DIST_SQ) return true;
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
  view: CanvasView;
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
  /** 範囲選択削除で複数のメモをまとめて削除する（完了後に1件の合算トーストを表示する） */
  onRemoveMany: (noteIds: string[]) => Promise<void>;
  onMove: (noteId: string, x: number, y: number) => Promise<void>;
  onAddLink: (a: string, b: string) => Promise<string>;
  onRemoveLink: (linkId: string) => Promise<void>;
};

export function Canvas({ notes, links, skin = 'leaf', view, onEdit, onRemove, onRemoveMany, onMove, onAddLink, onRemoveLink }: Props) {
  const showToast = useToast();

  // pan・zoom は useCanvasView フックから受け取る（page.tsx と共有）
  const { zoom, pan, setZoom, setPan, zoomRef, panRef, canvasRef } = view;

  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [cutMode, setCutMode] = useState(false);
  const [cutLine, setCutLine] = useState<CutLineState | null>(null);
  const [panDragging, setPanDragging] = useState(false);
  // つなぐモード（タップ→タップの2ステップで接続する補助モード。既存のハンドルドラッグ方式と併存する）
  const [connectMode, setConnectMode] = useState(false);
  // つなぐモードで1つ目にタップされたメモID（未選択時はnull）
  const [tapConnectFromId, setTapConnectFromId] = useState<string | null>(null);
  // 削除モード（タップで即削除する補助モード）
  const [deleteMode, setDeleteMode] = useState(false);
  // 範囲選択モード（背景ドラッグで矩形選択し、まとめて削除する補助モード）
  const [selectMode, setSelectMode] = useState(false);
  // 範囲選択で確定した選択中のメモID集合（ドラッグ中はリアルタイムに更新される）
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(() => new Set());
  // ドラッグ中の選択矩形（canvas要素基準のスクリーン座標px）。ドラッグ中のみ値を持つ
  const [selectRect, setSelectRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [showRangeDeleteConfirm, setShowRangeDeleteConfirm] = useState(false);
  const [rangeDeleting, setRangeDeleting] = useState(false);

  /** rAF 追従中のカード中心座標（note 座標系）。アニメーション中のみ値が存在する */
  const [liveCardCenters, setLiveCardCenters] = useState<Map<string, { cx: number; cy: number }>>(
    () => new Map()
  );

  // ── refs ─────────────────────────────────────────────────────────

  const cutStateRef = useRef<{
    startX: number; startY: number;
    prevX: number; prevY: number;
    cutIds: Set<string>;
  } | null>(null);

  // cutMode をレンダー毎に同期し、イベントハンドラーが常に最新値を参照できるようにする
  const cutModeRef = useRef(cutMode);
  cutModeRef.current = cutMode;

  // connectMode も同様にレンダー毎に同期する
  const connectModeRef = useRef(connectMode);
  connectModeRef.current = connectMode;

  // deleteMode も同様にレンダー毎に同期する
  const deleteModeRef = useRef(deleteMode);
  deleteModeRef.current = deleteMode;

  // selectMode も同様にレンダー毎に同期する
  const selectModeRef = useRef(selectMode);
  selectModeRef.current = selectMode;

  // 範囲選択ドラッグの開始座標（クライアント座標）。ドラッグ中のみ値を持つ
  const selectStateRef = useRef<{ startClientX: number; startClientY: number } | null>(null);

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

  // ── つなぐモード（タップ→タップ） ───────────────────────────────

  async function handleConnectModeTap(noteId: string) {
    if (!tapConnectFromId) {
      setTapConnectFromId(noteId);
      return;
    }
    if (tapConnectFromId === noteId) {
      // 同じメモを再タップ → 選択解除
      setTapConnectFromId(null);
      return;
    }
    const fromId = tapConnectFromId;
    setTapConnectFromId(null);
    try {
      await onAddLink(fromId, noteId);
    } catch (e) {
      console.error('[Canvas] handleConnectModeTap failed:', e);
      showToast('つながりの作成に失敗しました。再度お試しください。');
    }
  }

  // ── 削除モード（タップで即削除） ─────────────────────────────────

  async function handleDeleteModeTap(noteId: string) {
    // 確認ダイアログは挟まず即削除する。成功・失敗のトースト表示は
    // onRemove の実体（page.tsx の handleRemoveNote）が担う（既存の仕組みをそのまま利用）
    await onRemove(noteId);
  }

  // ── 範囲選択モード（背景ドラッグで矩形選択→まとめて削除） ─────────

  function handleCancelRangeSelection() {
    setSelectedNoteIds(new Set());
  }

  async function handleConfirmRangeDelete() {
    setRangeDeleting(true);
    await onRemoveMany(Array.from(selectedNoteIds));
    setRangeDeleting(false);
    setShowRangeDeleteConfirm(false);
    setSelectedNoteIds(new Set());
  }

  // ── キャンバスのポインターイベント ─────────────────────────────

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // ピンチ中はポインターイベントを無視（touch イベントが主導）
    if (pinchRef.current) {
      console.log('[CUT-DBG] PointerDown skipped: pinch active');
      return;
    }

    console.log('[CUT-DBG] PointerDown cutMode=%s pointerId=%d target=%s',
      cutModeRef.current, e.pointerId, (e.target as Element).tagName);

    const rect = e.currentTarget.getBoundingClientRect();

    if (cutModeRef.current) {
      const { x, y } = toNoteCoords(e.clientX, e.clientY, rect);
      e.currentTarget.setPointerCapture(e.pointerId);
      cutStateRef.current = { startX: x, startY: y, prevX: x, prevY: y, cutIds: new Set() };
      setCutLine({ x1: x, y1: y, x2: x, y2: y });
      console.log('[CUT-DBG] PointerDown: cut gesture started x=%f y=%f', x, y);
      return;
    }

    if (selectModeRef.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedNoteIds(new Set());
      selectStateRef.current = { startClientX: e.clientX, startClientY: e.clientY };
      setSelectRect({ left: e.clientX - rect.left, top: e.clientY - rect.top, width: 0, height: 0 });
      return;
    }

    if (connectModeRef.current) {
      // つなぐモード中は背景パンを無効化する（つなぐ操作自体はメモカードのタップで行う）
      return;
    }

    if (deleteModeRef.current) {
      // 削除モード中も背景パンを無効化する（削除操作自体はメモカードのタップで行う）
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

    if (cutModeRef.current) {
      let state = cutStateRef.current;

      if (!state) {
        if (e.buttons === 0) {
          // ホバー中（ボタン未押下）なので何もしない
          return;
        }
        // ボタン押下中なのに state が null = PointerLeave 等で消去されたと推定。
        // 現在地から state を再初期化してジェスチャーを継続する。
        console.log('[CUT-DBG] PointerMove: state lost while pressing → re-init');
        const { x: ix, y: iy } = toNoteCoords(e.clientX, e.clientY, rect);
        e.currentTarget.setPointerCapture(e.pointerId);
        cutStateRef.current = { startX: ix, startY: iy, prevX: ix, prevY: iy, cutIds: new Set() };
        state = cutStateRef.current;
        setCutLine({ x1: ix, y1: iy, x2: ix, y2: iy });
        return; // 次の PointerMove から交差判定を開始する
      }

      // state があっても buttons=0 = PointerUp/PointerCancel を経ずに指が離れた
      if (e.buttons === 0) {
        cutStateRef.current = null;
        setCutLine(null);
        return;
      }

      const { x, y } = toNoteCoords(e.clientX, e.clientY, rect);
      const { prevX, prevY, cutIds, startX, startY } = state;

      console.log('[CUT-DBG] PointerMove: links=%d prev=(%f,%f) cur=(%f,%f)',
        links.length, prevX, prevY, x, y);

      for (const link of links) {
        if (cutIds.has(link.id)) continue;
        const a = notesById.get(link.a);
        const b = notesById.get(link.b);
        if (!a || !b) {
          console.log('[CUT-DBG] link %s: note not found a=%s b=%s', link.id, link.a, link.b);
          continue;
        }
        // 最初の PointerMove のみリンク座標をログ出力（診断用）
        if (prevX === startX && prevY === startY) {
          console.log('[CUT-DBG] link %s endpoints: (%f,%f)→(%f,%f)',
            link.id, a.x + CARD_CX, a.y + CARD_CY, b.x + CARD_CX, b.y + CARD_CY);
        }
        const hit = gestureIntersectsLink(prevX, prevY, x, y, a.x + CARD_CX, a.y + CARD_CY, b.x + CARD_CX, b.y + CARD_CY);
        if (hit) {
          console.log('[CUT-DBG] DETECTED link=%s → queued (commit on PointerUp)', link.id);
          cutIds.add(link.id);
          // onRemoveLink はここでは呼ばない: 即時 DOM 削除が PointerCancel を誘発するため
          // PointerUp / PointerCancel(buttons=0) / PointerLeave(buttons=0) でまとめて commit する
        }
      }
      state.prevX = x;
      state.prevY = y;
      setCutLine({ x1: startX, y1: startY, x2: x, y2: y });
      return;
    }

    if (selectModeRef.current) {
      const state = selectStateRef.current;
      if (!state) return;

      const left = Math.min(state.startClientX, e.clientX) - rect.left;
      const top = Math.min(state.startClientY, e.clientY) - rect.top;
      const width = Math.abs(e.clientX - state.startClientX);
      const height = Math.abs(e.clientY - state.startClientY);
      setSelectRect({ left, top, width, height });

      // ヒットテスト: 矩形と少しでも重なるメモを選択状態にする（スクリーン座標で比較）
      const selLeft = Math.min(state.startClientX, e.clientX);
      const selTop = Math.min(state.startClientY, e.clientY);
      const selRight = Math.max(state.startClientX, e.clientX);
      const selBottom = Math.max(state.startClientY, e.clientY);

      const next = new Set<string>();
      for (const note of notes) {
        const cardEl = cardElMapRef.current.get(note.id);
        if (!cardEl) continue;
        const r = cardEl.getBoundingClientRect();
        const overlaps = r.left < selRight && r.right > selLeft && r.top < selBottom && r.bottom > selTop;
        if (overlaps) next.add(note.id);
      }
      setSelectedNoteIds(next);
      return;
    }

    const panDrag = panDragRef.current;
    if (panDrag) {
      setPan({ x: panDrag.startPanX + (e.clientX - panDrag.startPX), y: panDrag.startPanY + (e.clientY - panDrag.startPY) });
      return;
    }

    if (!connecting) return;
    const { x, y } = toNoteCoords(e.clientX, e.clientY, rect);

    // タッチ操作では pointerenter/leave が発火しないため elementFromPoint でカードを特定する。
    // SVG は pointer-events:none なのでカード要素まで透過できる。
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cardEl = el?.closest('[data-note-card="true"]') as HTMLElement | null;
    const hoveredId = cardEl?.dataset.noteId ?? null;
    const newTargetId = (hoveredId && hoveredId !== connecting.fromId) ? hoveredId : null;

    setConnecting((prev) => prev ? { ...prev, cursorX: x, cursorY: y, targetId: newTargetId } : null);
  }

  function commitCuts(state: typeof cutStateRef.current) {
    if (!state || state.cutIds.size === 0) return;
    const linkIds = Array.from(state.cutIds);
    void Promise.all(linkIds.map((id) => onRemoveLink(id)))
      .then(() => {
        const n = linkIds.length;
        showToast(n > 1 ? `${n}本のつながりを切りました` : 'つながりを切りました', 'success');
      })
      .catch((e) => {
        console.error('[Canvas] commitCuts failed:', e);
        showToast('つながりの切断に失敗しました。再度お試しください。');
      });
  }

  async function handleCanvasPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    console.log('[CUT-DBG] PointerUp cutMode=%s', cutModeRef.current);
    if (cutModeRef.current) {
      const state = cutStateRef.current;
      cutStateRef.current = null;
      setCutLine(null);
      commitCuts(state);
      return;
    }

    if (selectModeRef.current) {
      // ドラッグを離すと選択が確定する。選択矩形だけ消し、selectedNoteIdsは確定状態として残す
      selectStateRef.current = null;
      setSelectRect(null);
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
    if (targetId) {
      try {
        await onAddLink(fromId, targetId);
      } catch (e) {
        console.error('[Canvas] onAddLink failed:', e);
        showToast('つながりの作成に失敗しました。再度お試しください。');
      }
    }
  }

  function handleCanvasPointerLeave(e: React.PointerEvent<HTMLDivElement>) {
    console.log('[CUT-DBG] PointerLeave cutMode=%s state=%s buttons=%d',
      cutModeRef.current, cutStateRef.current ? 'ok' : 'null', e.buttons);
    if (cutModeRef.current) {
      if (e.buttons > 0) {
        // ボタン押下中（ジェスチャー中）の PointerLeave では state を維持する。
        // setPointerCapture が効いていれば本来発火しないが万一の場合も継続できるようにする。
        return;
      }
      // ホバーオフ（ボタン未押下）なら state と visual をクリアし、蓄積した切断を commit
      const state = cutStateRef.current;
      cutStateRef.current = null;
      setCutLine(null);
      commitCuts(state);
      return;
    }

    if (selectModeRef.current) {
      if (selectStateRef.current) {
        selectStateRef.current = null;
        setSelectRect(null);
      }
      return;
    }

    if (panDragRef.current) {
      panDragRef.current = null;
      setPanDragging(false);
      return;
    }

    if (connecting) setConnecting(null);
  }

  function handleCanvasPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    console.log('[CUT-DBG] PointerCancel cutMode=%s buttons=%d', cutModeRef.current, e.buttons);
    if (cutModeRef.current) {
      if (e.buttons > 0) {
        // ボタンがまだ押されている: state を維持して次の PointerMove でジェスチャーを継続
        return;
      }
      const state = cutStateRef.current;
      cutStateRef.current = null;
      setCutLine(null);
      commitCuts(state);
      return;
    }
    if (selectModeRef.current) {
      selectStateRef.current = null;
      setSelectRect(null);
      return;
    }
    if (panDragRef.current) {
      panDragRef.current = null;
      setPanDragging(false);
    }
  }

  // ── 切る操作（チップ） ────────────────────────────────────────────

  async function handleCutLink(linkId: string) {
    try {
      await onRemoveLink(linkId);
      setSelectedLinkId(null);
      showToast('つながりを切りました', 'success');
    } catch (e) {
      console.error('[Canvas] handleCutLink failed:', e);
      showToast('つながりの切断に失敗しました。再度お試しください。');
    }
  }

  function handleCanvasClick() {
    setSelectedLinkId(null);
    setTapConnectFromId(null);
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
      if (!prev) {
        // 切るモードをONにする: ハンドルドラッグ中の接続と、他の3モードを破棄する
        setConnecting(null);
        setConnectMode(false);
        setTapConnectFromId(null);
        setDeleteMode(false);
        setSelectMode(false);
        setSelectedNoteIds(new Set());
        setSelectRect(null);
      }
      return !prev;
    });
  }

  function handleToggleConnectMode() {
    setConnectMode((prev) => {
      if (!prev) {
        // つなぐモードをONにする: 他の3モードと同時には有効にしない。
        // ハンドルドラッグ中の接続状態が残っていれば破棄する
        setCutMode(false);
        setDeleteMode(false);
        setSelectMode(false);
        setSelectedNoteIds(new Set());
        setSelectRect(null);
        setConnecting(null);
      } else {
        setTapConnectFromId(null);
      }
      return !prev;
    });
  }

  function handleToggleDeleteMode() {
    setDeleteMode((prev) => {
      if (!prev) {
        // 削除モードをONにする: 他の3モードと同時には有効にしない
        setCutMode(false);
        setConnectMode(false);
        setTapConnectFromId(null);
        setConnecting(null);
        setSelectMode(false);
        setSelectedNoteIds(new Set());
        setSelectRect(null);
      }
      return !prev;
    });
  }

  function handleToggleSelectMode() {
    setSelectMode((prev) => {
      if (!prev) {
        // 範囲選択モードをONにする: 他の3モードと同時には有効にしない
        setCutMode(false);
        setConnectMode(false);
        setTapConnectFromId(null);
        setConnecting(null);
        setDeleteMode(false);
      } else {
        // 範囲選択モードをOFFにする: 選択状態も解除する
        setSelectedNoteIds(new Set());
        setSelectRect(null);
        setShowRangeDeleteConfirm(false);
      }
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
      className={`relative flex-1 overflow-hidden skin-${skin}`}
      style={{
        cursor: (cutMode || selectMode) ? 'crosshair' : (connectMode || deleteMode) ? 'pointer' : connecting ? 'crosshair' : panDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        backgroundColor: 'var(--field)',
        backgroundImage: 'var(--canvas-image)',
        backgroundSize: 'var(--canvas-size)',
      }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerCancel}
      onPointerLeave={handleCanvasPointerLeave}
      onClick={handleCanvasClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* 環境光グロー（木漏れ日エフェクト） */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-160px',
          right: '-120px',
          width: '460px',
          height: '460px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--ambient-1), transparent 68%)',
          pointerEvents: 'none',
        }}
      />

      {/* パン＋ズーム変換ラッパー */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          userSelect: 'none',
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
                selected={!cutMode && selectedLinkId === link.id}
                onSelect={cutMode ? undefined : () => setSelectedLinkId(link.id)}
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
            connectMode={connectMode}
            isConnectModeSelected={tapConnectFromId === note.id}
            onConnectModeTap={handleConnectModeTap}
            deleteMode={deleteMode}
            onDeleteModeTap={handleDeleteModeTap}
            selectMode={selectMode}
            isRangeSelected={selectedNoteIds.has(note.id)}
            onExpandChange={handleExpandChange}
          />
        ))}
      </div>

      {/* 範囲選択の矩形オーバーレイ: パン・ズームの影響を受けないよう変換ラッパーの外（スクリーン座標）に描画する */}
      {selectMode && selectRect && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: selectRect.left,
            top: selectRect.top,
            width: selectRect.width,
            height: selectRect.height,
            border: '1.5px dashed rgba(var(--accent-rgb), .9)',
            background: 'rgba(var(--accent-rgb), .12)',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      )}

      <CanvasControls
        noteCount={notes.length}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenter={handleCenter}
        cutMode={cutMode}
        onToggleCutMode={handleToggleCutMode}
        connectMode={connectMode}
        onToggleConnectMode={handleToggleConnectMode}
        deleteMode={deleteMode}
        onToggleDeleteMode={handleToggleDeleteMode}
        selectMode={selectMode}
        onToggleSelectMode={handleToggleSelectMode}
      />

      {/* 範囲選択の確定バー: ドラッグ終了後、選択件数が1件以上ある間だけ表示（トーストと被らない位置） */}
      {selectMode && !selectRect && selectedNoteIds.size > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            bottom: '160px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: '999px',
            boxShadow: '0 4px 14px var(--shadow)',
            padding: '8px 10px 8px 16px',
          }}
        >
          <span className="text-sm" style={{ color: 'var(--ink)' }}>
            {selectedNoteIds.size}件選択中
          </span>
          <button
            onClick={() => setShowRangeDeleteConfirm(true)}
            className="text-sm px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
            style={{ background: '#dc2626', color: '#ffffff', border: 'none' }}
          >
            削除
          </button>
          <button
            onClick={handleCancelRangeSelection}
            className="text-sm px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'transparent', color: 'var(--ink-soft)', border: '1px solid var(--line)' }}
          >
            キャンセル
          </button>
        </div>
      )}

      {/* 範囲選択削除の確認ポップアップ（設定画面のボード削除と同じスタイル）
          選択件数バー（zIndex: 150）より確実に手前に出るよう、Tailwindのz-50ではなく
          インラインstyleでzIndexを明示指定する */}
      {showRangeDeleteConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50"
          style={{ zIndex: 200 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4"
            style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
          >
            <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
              選択した{selectedNoteIds.size}件のメモを削除しますか？
            </h3>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              関連するつながりも合わせて削除されます。この操作は取り消せません。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRangeDeleteConfirm(false)}
                disabled={rangeDeleting}
                className="text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ border: '1px solid var(--line)', color: 'var(--ink)', background: 'transparent' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmRangeDelete}
                disabled={rangeDeleting}
                className="text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--dusk)', color: '#fff' }}
              >
                {rangeDeleting ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
