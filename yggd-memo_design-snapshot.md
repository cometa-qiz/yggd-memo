# yggd-memo — 設計スナップショット

> 外部設計レビュー用資料  
> 生成日: 2026-07-06

---

## 1. Firestore データモデル・コレクション設計

### コレクション階層

```
users/{userId}/
  boards/{boardId}
    notes/{noteId}
    links/{linkId}
```

すべてのデータはユーザー単位のサブコレクションに閉じており、クロスユーザー参照は行わない。

---

### 型定義（`src/types/index.ts`）

```typescript
type BoardSkin = 'leaf' | 'default' | 'cloud';

type Board = {
  id: string;
  name: string;
  skin: BoardSkin;
  isActive: boolean;      // 論理削除フラグ
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type Note = {
  id: string;
  text: string;
  x: number;              // キャンバス上の座標
  y: number;
  isActive: boolean;      // 論理削除フラグ
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type Link = {
  id: string;
  a: string;              // 接続元 noteId
  b: string;              // 接続先 noteId
  isActive: boolean;      // 論理削除フラグ
  createdAt: Timestamp;
  // updatedAt なし（リンクは位置を持たないため更新不要）
};
```

---

### 設計上の制約（`src/lib/firestore.ts` より抜粋）

| 操作 | 実装方針 |
|------|----------|
| 削除 | 物理削除禁止。`isActive: false` による論理削除のみ |
| 購読 | `onSnapshot` によるリアルタイム購読。クライアント側で `isActive === true` をフィルタ |
| メモ削除時 | `deactivateLinksForNote` で孤立リンクを同時に論理削除 |
| ボード全消し | `deactivateAllNotesAndLinks` で notes / links を並列一括処理 |
| リンク検索 | `a` / `b` フィールドへ単一フィールドクエリを並列発行（複合インデックス不要） |
| タイムスタンプ | `serverTimestamp()` を使用（クライアント時刻は使わない） |

---

## 2. firestore.rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**ポイント:**
- 認証済みユーザー（`request.auth != null`）のみアクセス可
- `request.auth.uid == userId` により、自分のデータのみ読み書き可能
- ワイルドカード `{document=**}` でサブコレクション（boards / notes / links）を一括カバー

---

## 3. firebase.json と package.json

### firebase.json

```json
{
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- デプロイ先: Firebase Hosting（静的エクスポート `next export` の `out/` ディレクトリ）
- SPA 用に全パスを `/index.html` にリライト
- Firestore Emulator 設定なし（本番 Firestore を直接使用）

---

### package.json — dependencies

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `firebase` | ^12.15.0 | Firestore / Auth SDK |
| `next` | 16.2.9 | フレームワーク（App Router） |
| `react` | 19.2.4 | UI ライブラリ |
| `react-dom` | 19.2.4 | React DOM |

### package.json — devDependencies

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `@tailwindcss/postcss` | ^4 | Tailwind CSS v4 PostCSS プラグイン |
| `@types/node` | ^20 | Node.js 型定義 |
| `@types/react` | ^19 | React 型定義 |
| `@types/react-dom` | ^19 | React DOM 型定義 |
| `eslint` | ^9 | Linter |
| `eslint-config-next` | 16.2.9 | Next.js 用 ESLint 設定 |
| `firebase-tools` | ^15.21.0 | Firebase CLI（デプロイ用） |
| `tailwindcss` | ^4 | CSS ユーティリティフレームワーク |
| `typescript` | ^5 | 型チェック |

---

## 4. フォルダ構成

`node_modules/` / `.next/` / `.git/` / `.env*` / `out/`（ビルド成果物）を除く。

```
yggd-memo/
├── .claude/
│   └── settings.local.json
├── .firebaserc
├── .gitignore
├── AGENTS.md
├── CONTRIBUTING.md
├── README.md
├── docs/
│   ├── agent_prompt.md
│   ├── constraints.md
│   ├── design-mockup.html
│   ├── glossary.md
│   ├── quickstart.md
│   ├── requirements.md
│   ├── review_checklist.md
│   └── status.md
├── eslint.config.mjs
├── firebase.json
├── firestore.rules
├── next.config.ts
├── next-env.d.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
├── public/
│   ├── apple-touch-icon.png
│   ├── file.svg
│   ├── globe.svg
│   ├── logo-mask.png
│   ├── next.svg
│   ├── vercel.svg
│   ├── window.svg
│   └── yggd-memo-logo-mask.png
├── src/
│   ├── app/
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx          # ルートレイアウト（AppProviders, AuthGuard）
│   │   ├── page.tsx            # キャンバスページ（ルート /）
│   │   ├── list/
│   │   │   └── page.tsx        # リスト表示ページ
│   │   ├── login/
│   │   │   └── page.tsx        # ログインページ
│   │   └── settings/
│   │       └── page.tsx        # 設定ページ
│   ├── components/
│   │   ├── AppProviders.tsx    # Context プロバイダーまとめ
│   │   ├── AuthGuard.tsx       # 未認証リダイレクト
│   │   ├── canvas/
│   │   │   ├── Canvas.tsx      # SVG キャンバス本体
│   │   │   ├── CanvasControls.tsx
│   │   │   ├── LinkLine.tsx    # リンク描画（SVG line）
│   │   │   └── NoteCard.tsx    # メモカード（ドラッグ対応）
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── NoteInput.tsx   # メモ入力フォーム
│   │   ├── list/
│   │   │   ├── ExportButtons.tsx
│   │   │   ├── GroupItem.tsx
│   │   │   └── GroupList.tsx
│   │   ├── settings/
│   │   │   ├── BoardManager.tsx
│   │   │   ├── DangerZone.tsx
│   │   │   └── SkinSelector.tsx
│   │   └── ui/
│   │       └── Toast.tsx
│   ├── contexts/
│   │   ├── BoardsContext.tsx   # アクティブボード状態管理
│   │   └── ToastContext.tsx
│   ├── hooks/
│   │   ├── useAuth.ts          # Firebase Auth 状態
│   │   ├── useBoards.ts        # ボード CRUD
│   │   ├── useCanvasView.ts    # ズーム・パン状態
│   │   ├── useLinks.ts         # リンク CRUD
│   │   └── useNotes.ts         # メモ CRUD
│   ├── lib/
│   │   ├── firebase.ts         # Firebase 初期化
│   │   └── firestore.ts        # Firestore 読み書き関数
│   ├── types/
│   │   └── index.ts            # Board / Note / Link 型定義
│   └── utils/
│       ├── exportUtils.ts      # エクスポート処理
│       ├── graphUtils.ts       # グラフ構造ユーティリティ
│       └── positionUtils.ts    # 座標計算
└── tsconfig.json
```
