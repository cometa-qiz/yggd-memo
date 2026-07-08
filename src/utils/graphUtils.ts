import type { Note, Link } from '@/types';

// ── 公開型 ────────────────────────────────────────────────────────

/** 木構造の1ノード */
export type TreeNode = {
  note: Note;
  children: TreeNode[];
};

/**
 * つながっているメモの連結成分（グループ）。
 * 単独のメモも1件グループとして扱う。
 */
export type NoteGroup = {
  notes: Note[];
  links: Link[];
  /** グループ内で最も古く作成されたメモのID（デフォルト根） */
  defaultRootId: string;
};

// ── グループ化（連結成分の列挙） ──────────────────────────────────

/**
 * notes と links の中から isActive: true のものだけを対象に、
 * つながっているメモ同士を1グループとして連結成分を列挙して返す。
 *
 * - 単独のメモ（どのリンクにも属さない）も1グループとして返す
 * - 各グループの defaultRootId は createdAt が最も古いメモ
 * - 返す配列はグループ内メモ数が多い順（単独グループは末尾）
 */
export function groupNotes(notes: Note[], links: Link[]): NoteGroup[] {
  const activeNotes = notes.filter((n) => n.isActive);
  const activeLinks = links.filter((l) => l.isActive);

  if (activeNotes.length === 0) return [];

  const noteMap = new Map<string, Note>(activeNotes.map((n) => [n.id, n]));

  // 双方向隣接リストを構築（孤立ノード分も初期化）
  const adj = new Map<string, Set<string>>();
  for (const note of activeNotes) {
    adj.set(note.id, new Set());
  }
  for (const link of activeLinks) {
    // 両端のメモが isActive な場合のみ辺を張る
    if (noteMap.has(link.a) && noteMap.has(link.b)) {
      adj.get(link.a)!.add(link.b);
      adj.get(link.b)!.add(link.a);
    }
  }

  // BFS で連結成分を列挙
  const visited = new Set<string>();
  const groups: NoteGroup[] = [];

  for (const note of activeNotes) {
    if (visited.has(note.id)) continue;

    const componentIds: string[] = [];
    const queue: string[] = [note.id];
    visited.add(note.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      componentIds.push(current);
      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    const groupNoteList = componentIds.map((id) => noteMap.get(id)!);
    const idSet = new Set(componentIds);
    const groupLinkList = activeLinks.filter(
      (l) => idSet.has(l.a) && idSet.has(l.b)
    );

    // デフォルト根: グループ内で最も古く作成されたメモ
    const defaultRoot = groupNoteList.reduce((oldest, n) =>
      n.createdAt.toMillis() < oldest.createdAt.toMillis() ? n : oldest
    );

    groups.push({
      notes: groupNoteList,
      links: groupLinkList,
      defaultRootId: defaultRoot.id,
    });
  }

  // 複数メモを持つグループを先頭に、単独グループを末尾に並べる
  return groups.sort((a, b) => b.notes.length - a.notes.length);
}

// ── リンクのユーティリティ ────────────────────────────────────────

/**
 * links の中から a/b（向き問わず）が一致する isActive なリンクを1件返す。
 * リンク新規作成前の重複チェックに使う（同じペアに2本目を作らせない）。
 */
export function findActiveLink(links: Link[], a: string, b: string): Link | undefined {
  return links.find(
    (l) => l.isActive && ((l.a === a && l.b === b) || (l.a === b && l.b === a))
  );
}

// ── 木構造変換 ────────────────────────────────────────────────────

/**
 * 指定した rootId を根として、notes/links（isActive: true のみ）を
 * 木構造に変換して返す。
 *
 * - links を無向グラフとして扱い、DFS で子ノードを展開する
 * - 循環リンクが存在しても visited セットで無限ループを防ぐ
 * - rootId に対応する isActive なメモが存在しない場合は null を返す
 */
export function buildTree(
  notes: Note[],
  links: Link[],
  rootId: string,
): TreeNode | null {
  const activeNotes = notes.filter((n) => n.isActive);
  const activeLinks = links.filter((l) => l.isActive);

  const noteMap = new Map<string, Note>(activeNotes.map((n) => [n.id, n]));

  if (!noteMap.has(rootId)) return null;

  // 双方向隣接リスト
  const adj = new Map<string, string[]>();
  for (const note of activeNotes) {
    adj.set(note.id, []);
  }
  for (const link of activeLinks) {
    if (noteMap.has(link.a) && noteMap.has(link.b)) {
      adj.get(link.a)!.push(link.b);
      adj.get(link.b)!.push(link.a);
    }
  }

  // DFS で木を再帰構築
  function buildNode(nodeId: string, visited: Set<string>): TreeNode {
    const children: TreeNode[] = [];
    for (const neighborId of adj.get(nodeId) ?? []) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        children.push(buildNode(neighborId, visited));
      }
    }
    return { note: noteMap.get(nodeId)!, children };
  }

  const visited = new Set<string>([rootId]);
  return buildNode(rootId, visited);
}
