'use client';

import { useState } from 'react';
import { buildTree, type NoteGroup, type TreeNode } from '@/utils/graphUtils';

type Props = {
  group: NoteGroup;
  rootId: string;
  isRootOverridden: boolean;
  onSetRoot: (noteId: string) => void;
  onResetRoot: () => void;
  onAddLink: (a: string, b: string) => Promise<string>;
  onRemoveLink: (linkId: string) => Promise<void>;
};

type DragState = {
  noteId: string;
  /** ツリー上の親ノードID。ルートの場合は null */
  parentId: string | null;
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
  onDragStart: (noteId: string, parentId: string | null) => void;
  onDragOver: (noteId: string) => void;
  onDrop: (noteId: string) => void;
  onDragEnd: () => void;
};

function TreeNodeView({
  node, parentId, depth, isLast, continuations, onSetRoot,
  draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd,
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
        draggable={!isRoot}
        onDragStart={
          !isRoot
            ? (e) => { e.stopPropagation(); onDragStart(node.note.id, parentId); }
            : undefined
        }
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(node.note.id); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(node.note.id); }}
        onDragEnd={onDragEnd}
        className="flex items-start gap-2 py-0.5 rounded transition-colors"
        style={{
          background: isDragOver ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent',
          opacity: isDragging ? 0.4 : 1,
          cursor: isDragging ? 'grabbing' : (!isRoot ? 'grab' : 'default'),
          outline: isDragOver ? '1px solid rgba(var(--accent-rgb), 0.4)' : 'none',
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

        {/* 根にするボタン */}
        {!isRoot && (
          <button
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
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * 1グループ分のメモを木構造で表示し、ドラッグ操作で親子関係を変更できる。
 * - 非ルートノードをドラッグして別ノードにドロップすると、古いリンクを削除し新しいリンクを追加する
 * - ルートノードはドラッグ不可（「これを根にする」で根を変更する）
 */
export function GroupItem({
  group, rootId, isRootOverridden, onSetRoot, onResetRoot, onAddLink, onRemoveLink,
}: Props) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const tree = buildTree(group.notes, group.links, rootId);
  if (!tree) return null;

  function handleDragStart(noteId: string, parentId: string | null) {
    setDragState({ noteId, parentId });
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDragState(null);
    setDragOverId(null);
  }

  async function handleDrop(targetId: string) {
    if (!dragState) return;
    const { noteId: draggedId, parentId: currentParentId } = dragState;

    setDragState(null);
    setDragOverId(null);

    if (draggedId === targetId) return;
    if (currentParentId === targetId) return;

    if (currentParentId !== null) {
      const oldLink = group.links.find(
        (l) =>
          l.isActive &&
          ((l.a === draggedId && l.b === currentParentId) ||
            (l.b === draggedId && l.a === currentParentId)),
      );
      if (oldLink) await onRemoveLink(oldLink.id);
    }

    const linkExists = group.links.some(
      (l) =>
        l.isActive &&
        ((l.a === draggedId && l.b === targetId) ||
          (l.b === draggedId && l.a === targetId)),
    );
    if (!linkExists) await onAddLink(draggedId, targetId);
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
          draggingId={dragState?.noteId ?? null}
          dragOverId={dragOverId}
          onDragStart={handleDragStart}
          onDragOver={setDragOverId}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
      </ul>
    </section>
  );
}
