import { buildTree, type NoteGroup, type TreeNode } from './graphUtils';

// ── ダウンロードヘルパー ──────────────────────────────────────────

/** Blob URL を使ってファイルをブラウザでダウンロードする */
export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

// ── 全ボード一括書き出し（R2-6） ─────────────────────────────────────

/** 1ボード分のグループ一覧（根は常に defaultRootId を使う） */
export type BoardExportData = {
  boardName: string;
  groups: NoteGroup[];
};

/**
 * 全ボード分をまとめてインデント形式テキストとして書き出す。
 * ボードごとに `# ボード名` の見出し行を挟み、各グループは defaultRootId を根とする
 * （設定画面からの一括書き出しには「これを根にする」の一時的な上書き状態は無いため）。
 */
export function exportAllBoardsAsCSV(boardsData: BoardExportData[]): string {
  const boardSections: string[] = [];

  for (const { boardName, groups } of boardsData) {
    const rootIds = groups.map((g) => g.defaultRootId);
    const body = exportAsCSV(groups, rootIds);
    boardSections.push(`# ${boardName}\n\n${body}`);
  }

  return boardSections.join('\n\n');
}

/**
 * 全ボード分をまとめてネスト JSON として書き出す。
 * `[{ board: string, groups: JsonNode[] }, ...]` の形式。
 */
export function exportAllBoardsAsJSON(boardsData: BoardExportData[]): string {
  const result = boardsData.map(({ boardName, groups }) => {
    const rootIds = groups.map((g) => g.defaultRootId);
    const groupNodes: JsonNode[] = [];
    for (let i = 0; i < groups.length; i++) {
      const tree = buildTree(groups[i].notes, groups[i].links, rootIds[i]);
      if (tree) groupNodes.push(treeToJsonNode(tree));
    }
    return { board: boardName, groups: groupNodes };
  });

  return JSON.stringify(result, null, 2);
}
