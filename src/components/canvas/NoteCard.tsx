'use client';

import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import type { Note, BoardSkin } from '@/types';


type Props = {
  note: Note;
  skin?: BoardSkin;
  zoom?: number;
  cutMode?: boolean;
  onEdit: (noteId: string, text: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
  onMove: (noteId: string, x: number, y: number) => Promise<void>;
  onConnectStart: (noteId: string) => void;
  onConnectEnter: (noteId: string) => void;
  onConnectLeave: (noteId: string) => void;
  isConnectTarget: boolean;
  /** clip-path アニメーション開始を親（Canvas）に通知するコールバック */
  onExpandChange?: (noteId: string) => void;
};

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD = 5;

export const NoteCard = forwardRef<HTMLDivElement, Props>(function NoteCard({
  note,
  skin = 'leaf',
  zoom = 1,
  cutMode = false,
  onEdit,
  onRemove,
  onMove,
  onConnectStart,
  onConnectEnter,
  onConnectLeave,
  isConnectTarget,
  onExpandChange,
}, ref) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [isDragging, setIsDragging] = useState(false);
  const [isClamped, setIsClamped] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // forwarded ref (Canvas の callback ref) を常に最新値として保持し、
  // assignRefs が stable callback のまま最新の ref を呼べるようにする
  const latestRefRef = useRef(ref);
  latestRefRef.current = ref;

  const assignRefs = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    const r = latestRefRef.current;
    if (typeof r === 'function') r(el);
    else if (r) (r as React.MutableRefObject<HTMLDivElement | null>).current = el;
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({
    started: false,
    active: false,
    startPX: 0,
    startPY: 0,
    startX: 0,
    startY: 0,
  });
  const preventClickRef = useRef(false);

  // コールバックを ref に保持して stale closure を避ける
  const onExpandChangeRef = useRef(onExpandChange);
  useEffect(() => { onExpandChangeRef.current = onExpandChange; });

  useEffect(() => {
    if (!dragRef.current.active) {
      setPos({ x: note.x, y: note.y });
    }
  }, [note.x, note.y]);

  // 展開中に外側をクリック（PointerDown）したら収納する
  useEffect(() => {
    if (!expanded) return;
    const handleOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [expanded]);

  // body の scrollHeight > clientHeight なら clamped（テキストが 4.5em を超える）
  useEffect(() => {
    if (editing || expanded || !bodyRef.current) {
      setIsClamped(false);
      return;
    }
    setIsClamped(bodyRef.current.scrollHeight > bodyRef.current.clientHeight);
  }, [note.text, editing, expanded]);

  // skin と展開状態からクリップパスクラスを決定する
  // collapsed 時: leaf→clip-leaf / cloud→clip-cloud / default→clip-rounded-rect（変形なし）
  const collapsedClass = skin === 'cloud' ? 'clip-cloud' : skin === 'default' ? 'clip-rounded-rect' : 'clip-leaf';
  const clipClass = editing || expanded ? 'clip-rounded-rect' : collapsedClass;
  const prevClipClassRef = useRef(clipClass);
  useEffect(() => {
    if (clipClass !== prevClipClassRef.current) {
      prevClipClassRef.current = clipClass;
      onExpandChangeRef.current?.(note.id);
    }
  });

  function cancelLongPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (editing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      started: true,
      active: false,
      startPX: e.clientX,
      startPY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };

    timerRef.current = setTimeout(() => {
      if (!dragRef.current.active) {
        setDraft(note.text);
        setEditing(true);
      }
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (editing || !dragRef.current.started) return;
    const dx = e.clientX - dragRef.current.startPX;
    const dy = e.clientY - dragRef.current.startPY;

    if (!dragRef.current.active && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      cancelLongPress();
      dragRef.current.active = true;
      setIsDragging(true);
    }

    if (dragRef.current.active) {
      setPos({ x: dragRef.current.startX + dx / zoom, y: dragRef.current.startY + dy / zoom });
    }
  }

  async function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    cancelLongPress();
    if (!dragRef.current.started) return;
    dragRef.current.started = false;

    if (dragRef.current.active) {
      const finalX = dragRef.current.startX + (e.clientX - dragRef.current.startPX) / zoom;
      const finalY = dragRef.current.startY + (e.clientY - dragRef.current.startPY) / zoom;
      dragRef.current.active = false;
      setIsDragging(false);
      setPos({ x: finalX, y: finalY });
      preventClickRef.current = true;
      await onMove(note.id, finalX, finalY);
    }
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (preventClickRef.current) {
      preventClickRef.current = false;
      return;
    }
    if (editing) return;
    setExpanded((prev) => !prev);
  }

  async function handleSave() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.text) {
      await onEdit(note.id, trimmed);
    }
    setEditing(false);
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    await onRemove(note.id);
  }

  return (
    <div
      ref={assignRefs}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        cursor: cutMode ? 'default' : isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 10 : 1,
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: cutMode ? 'none' : undefined,
      }}
      className="group relative min-w-[150px] max-w-[250px]"
      data-note-card="true"
      data-note-id={note.id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={() => onConnectEnter(note.id)}
      onPointerLeave={() => onConnectLeave(note.id)}
      onClick={handleClick}
    >
      {/*
       * クリップラッパー: clip-path + filter をここに集約する。
       * CSS の描画順序上、clip-path でクリップした後に filter が適用されるため、
       * drop-shadow はクリップ外に描画される。テキストはラッパー内に収まり
       * カードの有機的な形からはみ出せない。
       * 削除ボタン・接続ハンドルは兄弟要素として外に置き、クリップ対象から外す。
       */}
      <div
        className={clipClass}
        style={{
          position: 'relative',
          padding: expanded ? '18px 20px 18px 20px' : 'var(--card-pad)',
          minHeight: expanded ? undefined : '74px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box',
          filter: isConnectTarget
            ? 'var(--card-filter) drop-shadow(0 0 9px rgba(var(--accent-rgb),.85))'
            : 'var(--card-filter)',
        }}
      >
        {/* 背景グラデーション: クリップラッパー全域を覆う */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            background: 'var(--card-fill)',
          }}
        />

        {/* テキスト本体 */}
        <div
          ref={bodyRef}
          className="relative"
          style={{
            zIndex: 1,
            color: 'var(--ink)',
            overflow: 'hidden',
            maxHeight: editing ? 'none' : expanded ? '60em' : '4.5em',
            transition: 'max-height .42s cubic-bezier(.16, .84, .44, 1)',
            WebkitMaskImage: (isClamped && !expanded && !editing)
              ? 'linear-gradient(180deg, #000 76%, transparent)'
              : undefined,
            maskImage: (isClamped && !expanded && !editing)
              ? 'linear-gradient(180deg, #000 76%, transparent)'
              : undefined,
          }}
        >
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              autoFocus
              rows={3}
              className="w-full resize-none bg-transparent text-sm focus:outline-none"
              style={{ color: 'var(--ink)' }}
            />
          ) : (
            <p className="select-none whitespace-pre-wrap break-words text-sm">
              {note.text}
            </p>
          )}
        </div>

        {/* タイムスタンプ: body の兄弟として配置。モックアップの .stamp に相当 */}
        {note.createdAt && !editing && (
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              marginTop: '7px',
              fontSize: '10.5px',
              letterSpacing: '.04em',
              color: 'var(--ink-soft)',
              fontVariantNumeric: 'tabular-nums',
              opacity: 0.8,
            }}
          >
            {(() => {
              const d = note.createdAt.toDate();
              const p = (n: number) => (n < 10 ? '0' : '') + n;
              return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
            })()}
          </div>
        )}

        {/* clamped インジケーター */}
        {isClamped && !expanded && !editing && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '6px',
              transform: 'translateX(-50%)',
              zIndex: 2,
              fontSize: '13px',
              lineHeight: 1,
              color: 'var(--dusk-soft)',
              opacity: 0.9,
              pointerEvents: 'none',
            }}
          >
            ⌄
          </span>
        )}
      </div>

      {/* 削除ボタン: 展開（選択）中のみ表示 */}
      {expanded && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRemove(e); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
          aria-label="メモを削除"
        >
          ✕
        </button>
      )}

      {/* 接続ハンドル: クリップラッパー外（クリップされない） */}
      {!cutMode && (
        <div
          className="connect-handle absolute -right-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-slate-300 bg-white opacity-0 transition-opacity group-hover:opacity-100 hover:border-blue-400"
          onPointerDown={(e) => {
            e.stopPropagation();
            onConnectStart(note.id);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="つなぐ"
        />
      )}
    </div>
  );
});
