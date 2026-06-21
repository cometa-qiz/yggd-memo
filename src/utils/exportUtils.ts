import { buildTree, type NoteGroup, type TreeNode } from './graphUtils';

// ── 内部型 ────────────────────────────────────────────────────────

type JsonNode = {
  text: string;
  children: JsonNode[];
};

// ── 内部ヘルパー ──────────────────────────────────────────────────

/**
 * 木ノードをインデント行に変換して lines に追記する。
 * 複数行のテキストは半角スペースに正規化し、1行に収める。
 */
function collectIndentedLines(node: TreeNode, depth: number, lines: string[]) {
  const indent = '  '.repeat(depth);
  const text = node.note.text.replace(/\r?\n/g, ' ');
  lines.push(`${indent}${text}`);
  for (const child of node.children) {
    collectIndentedLines(child, depth + 1, lines);
  }
}

/** 木ノードを JSON シリアライズ可能なネストオブジェクトに変換する */
function treeToJsonNode(node: TreeNode): JsonNode {
  return {
    text: node.note.text,
    children: node.children.map(treeToJsonNode),
  };
}

// ── 公開 API ─────────────────────────────────────────────────────

/**
 * グループ一覧をインデント形式テキストとして書き出す（.csv 保存向け）。
 *
 * - 深さ1段につき半角スペース2個のインデント
 * - 複数グループはブランク行で区切る
 * - `isActive: true` のノードのみ対象（buildTree が保証）
 *
 * @param groups  groupNotes() の戻り値（isActive: true のみ）
 * @param rootIds groups[i] の根ノードID（groups と同じ順序）
 */
export function exportAsCSV(groups: NoteGroup[], rootIds: string[]): string {
  const sections: string[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const rootId = rootIds[i] ?? group.defaultRootId;
    const tree = buildTree(group.notes, group.links, rootId);
    if (!tree) continue;

    const lines: string[] = [];
    collectIndentedLines(tree, 0, lines);
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * グループ一覧をネスト JSON として書き出す（.json 保存向け）。
 *
 * 各グループのツリーを `{ text, children[] }` の再帰構造で表現する。
 * `isActive: true` のノードのみ対象（buildTree が保証）。
 *
 * @param groups  groupNotes() の戻り値（isActive: true のみ）
 * @param rootIds groups[i] の根ノードID（groups と同じ順序）
 */
export function exportAsJSON(groups: NoteGroup[], rootIds: string[]): string {
  const result: JsonNode[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const rootId = rootIds[i] ?? group.defaultRootId;
    const tree = buildTree(group.notes, group.links, rootId);
    if (!tree) continue;

    result.push(treeToJsonNode(tree));
  }

  return JSON.stringify(result, null, 2);
}
