'use client';

import { useRef, useState } from 'react';
import { buildTree, findActiveLink, type NoteGroup, type TreeNode } from '@/utils/graphUtils';

type Props = {
  group: NoteGroup;
  rootId: string;
  isRootOverridden: boolean;
  onSetRoot: (noteId: string) => void;
  onResetRoot: () => void;
  onAddLink: (a: string, b: string) => Promise<string>;
  onRemoveLink: (linkId: string) => Promise<void>;
};

// Ref で同期的に管理するドラッグ状態
type DragRef = {
  noteId: string;
  parentId: string | null;
  startX: number;
  startY: number;
  active: boolean; // 閾値を超えて視覚ドラッグが始まったか
};

type NodeViewProps = {
  node: TreeNode;
  parentId: string | null;
  depth: number;
  isLast: boolean;
  continuations: boolean[];
  onSetRoot: (noteId: string) => void;
  draggingId: string | null;
  dragOverId: string | null;
  onNodePointerDown: (e: React.PointerEvent, noteId: string, parentId: string | null) => void;
  onNodePointerMove: (e: React.PointerEvent) => void;
  onNodePointerUp: (e: React.PointerEvent) => void;
  onNodePointerCancel: () => void;
};

function TreeNodeView({
  node, parentId, depth, isLast, continuations, onSetRoot,
  draggingId, dragOverId,
  onNodePointerDown, onNodePointerMove, onNodePointerUp, onNodePointerCancel,
}: NodeViewProps) {
  const isRoot = depth === 0;
  const isDragging = draggingId === node.note.id;
  const isDragOver = dragOverId === node.note.id && draggingId !== node.note.id;

  let prefix = '';
  if (!isRoot) {
    for (let i = 0; i < depth - 1; i++) {
      prefix += continuations[i] ? '│ ' : '  ';
    }
    prefix += isLast ? '└─' : '├─';
  }

  return (
    <li className="list-none">
      <div
        data-note-id={node.note.id}
        onPointerDown={
          !isRoot
            ? (e) => {
                e.stopPropagation();
                // 即座にキャプチャ → 以降のmove/upを確実にこの要素で受け取る
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                onNodePointerDown(e, node.note.id, parentId);
              }
            : undefined
        }
        onPointerMove={onNodePointerMove}
        onPointerUp={onNodePointerUp}
        onPointerCancel={onNodePointerCancel}
        className="flex items-start gap-2 py-0.5 rounded transition-colors"
        style={{
          background: isDragOver ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent',
          opacity: isDragging ? 0.4 : 1,
          cursor: draggingId != null
            ? (isDragging ? 'grabbing' : 'default')
            : (!isRoot ? 'grab' : 'default'),
          outline: isDragOver ? '1px solid rgba(var(--accent-rgb), 0.4)' : 'none',
          // タッチデバイスでブラウザのスクロール処理をキャンセルし、ドラッグを優先させる
          touchAction: !isRoot ? 'none' : 'auto',
          userSelect: 'none',
        }}
      >
        {/* ツリー線・根マーク */}
        <span
          className="mt-0.5 select-none whitespace-pre font-mono text-xs"
          style={{ color: 'var(--ink-soft)' }}
          aria-hidden
        >
          {isRoot ? '■ ' : `${prefix} `}
        </span>

        {/* メモ本文 */}
        <p
          className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-snug"
          style={{ color: 'var(--ink)' }}
        >
          {node.note.text}
          {isRoot && (
            <span
              className="ml-1.5 inline-block align-middle rounded px-1 py-px text-xs font-medium"
              style={{
                background: 'rgba(var(--accent-rgb), 0.18)',
                color: 'var(--dusk)',
              }}
            >
              根
            </span>
          )}
        </p>

        {/* 根にするボタン: pointerdown を止めてドラッグ開始を防ぎ、click を正常に発火させる */}
        {!isRoot && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSetRoot(node.note.id)}
            title="この操作は一時的です。ページを再読み込みするとデフォルトに戻ります"
            className="mt-0.5 shrink-0 text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--dusk)' }}
          >
            根にする
          </button>
        )}
      </div>

      {node.children.length > 0 && (
        <ul>
          {node.children.map((child, i) => (
            <TreeNodeView
              key={child.note.id}
              node={child}
              parentId={node.note.id}
              depth={depth + 1}
              isLast={i === node.children.length - 1}
              continuations={[...continuations, !isLast]}
              onSetRoot={onSetRoot}
              draggingId={draggingId}
              dragOverId={dragOverId}
              onNodePointerDown={onNodePointerDown}
              onNodePointerMove={onNodePointerMove}
              onNodePointerUp={onNodePointerUp}
              onNodePointerCancel={onNodePointerCancel}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const DRAG_THRESHOLD_PX = 8;

/**
 * 1グループ分のメモを木構造で表示し、ドラッグ操作で親子関係を変更できる。
 * - Pointer Events でマウス・タッチ両対応（HTML5 DnD API は使用しない）
 * - 非ルートノードを DRAG_THRESHOLD_PX 以上動かすとドラッグ開始
 * - ルートノードはドラッグ不可（「これを根にする」で根を変更する）
 */
export function GroupItem({
  group, rootId, isRootOverridden, onSetRoot, onResetRoot, onAddLink, onRemoveLink,
}: Props) {
  // イベントハンドラ内で同期的に参照するためにrefを使う
  const dragRef = useRef<DragRef | null>(null);
  // 描画用のstate（refとは別に管理）
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const tree = buildTree(group.notes, group.links, rootId);
  if (!tree) return null;

  function handlePointerDown(e: React.PointerEvent, noteId: string, parentId: string | null) {
    dragRef.current = {
      noteId,
      parentId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const dr = dragRef.current;
    if (!dr) return;

    if (!dr.active) {
      const dx = e.clientX - dr.startX;
      const dy = e.clientY - dr.startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      dr.active = true;
      setDraggingId(dr.noteId);
    }

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = (el as Element | null)?.closest('[data-note-id]') as HTMLElement | null;
    setDragOverId(target?.dataset?.noteId ?? null);
  }

  function clearDrag() {
    dragRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }

  function handlePointerUp(e: React.PointerEvent) {
    const dr = dragRef.current;
    if (!dr) return;

    if (!dr.active) {
      // 閾値未満のタップ → ドラッグとして扱わない
      dragRef.current = null;
      return;
    }

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = (el as Element | null)?.closest('[data-note-id]') as HTMLElement | null;
    const targetId = target?.dataset?.noteId ?? null;

    // clearDrag を先に呼んでから非同期処理へ
    const { noteId: draggedId, parentId: currentParentId } = dr;
    clearDrag();

    if (targetId) void executeDrop(draggedId, currentParentId, targetId);
  }

  async function executeDrop(
    draggedId: string,
    currentParentId: string | null,
    targetId: string,
  ) {
    if (draggedId === targetId) return;
    if (currentParentId === targetId) return;

    if (currentParentId !== null) {
      const oldLink = findActiveLink(group.links, draggedId, currentParentId);
      if (oldLink) await onRemoveLink(oldLink.id);
    }

    if (!findActiveLink(group.links, draggedId, targetId)) {
      await onAddLink(draggedId, targetId);
    }
  }

  return (
    <section
      className="overflow-hidden rounded-xl"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        filter: 'var(--card-filter)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          borderBottom: '1px solid var(--line)',
          background: 'rgba(255,255,255,0.04)',
        }}
      >
        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          {group.notes.length}件のメモ
        </span>
        {isRootOverridden && (
          <button
            onClick={onResetRoot}
            className="text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--ink-soft)' }}
          >
            デフォルトに戻す
          </button>
        )}
      </div>
      <ul className="px-3 py-2">
        <TreeNodeView
          node={tree}
          parentId={null}
          depth={0}
          isLast
          continuations={[]}
          onSetRoot={onSetRoot}
          draggingId={draggingId}
          dragOverId={dragOverId}
          onNodePointerDown={handlePointerDown}
          onNodePointerMove={handlePointerMove}
          onNodePointerUp={handlePointerUp}
          onNodePointerCancel={clearDrag}
        />
      </ul>
    </section>
  );
}
