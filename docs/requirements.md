# Yggd-memo 要件定義書

> バージョン: 1.0
> 作成日: 2026-06-19

---

## 1. プロジェクト概要

思いついたことをすぐにメモでき、メモ同士のつながりを視覚的に確認しながら、
最終的には箇条書き（アウトライン）としてまとめて書き出せるWebアプリケーション。

既存のメモアプリは記録の手軽さに優れるが、メモ同士の関係性を整理しづらい。
マインドマップ形式のツールは関係性の整理に優れるが、テキストとしてまとめて
読み返す・転記することが難しい。本アプリはこの両方の利点を両立させることを
目的とする。

スマートフォン・PCの両方から同一データにアクセスでき、複数のデバイスで
同時に開いていてもリアルタイムに反映される設計とする。

アプリ名は「Yggd-memo」。
正式名称は裏側（タイトルタグ・設定画面など）で使用し、画面ヘッダーには
専用のロゴマークを表示する。

---

## 2. 技術スタック

| レイヤー | 採用技術 | 理由 |
|---------|---------|------|
| フロントエンド | Next.js + TypeScript | App Router採用・静的エクスポートでFirebase Hostingに対応 |
| スタイリング | Tailwind CSS + 素のCSS | カードの形状（clip-path）やアニメーションは素のCSSで実装 |
| アニメーション | CSS Transition（追加ライブラリなし） | ドラッグ・接続操作がReactの外側で動く処理のため、状態駆動型のライブラリとは相性が悪い |
| データベース | Firebase Firestore | リアルタイム同期・無料枠が広い |
| 認証 | Firebase Authentication（Google Sign-in） | 複数デバイス間のデータ同期に必要 |
| ホスティング | Firebase Hosting | Firestoreと同一プロジェクトで管理可能 |
| パッケージマネージャー | pnpm | npm install禁止のルールを踏襲 |

### Next.js 設定方針

- **App Router** を使用する（`src/app/` ディレクトリ）
- **Static Export**（`output: 'export'`）を使用し、Firebase Hostingに静的ファイルとして配信する
- Firestoreへのアクセスはすべてクライアントサイドで行うため、SSR・APIルートは使用しない
- URLにボードIDやノートIDなどの動的な値は含めない（Static Exportの動的ルート制約を回避するため）
- ビルド成果物は `out/` ディレクトリに出力される

### カード展開アニメーションの方針

- 葉っぱ型カード → 角丸四角ウィンドウへの変形は `clip-path` の `transition` で実現する
- イージングは `cubic-bezier(.16,.84,.44,1)`（終盤にかけて減速し、すっと収まる質感）を採用
- 時間は0.42秒を基準とする
- 全カードがクリックで展開・収納できる（長文・短文を問わない）
- 展開時に変化する要素は「形（葉っぱ→角丸四角）」と「サイズ（padding・幅・高さ）」の2つ
- サイズの変化量はテキスト内容に応じて自然に決まる（長文は大きく広がり、短文はほぼ変化しない）
- 形の変化は全カード共通でアニメーションする

---

## 3. システム構成

```
[ユーザー（ブラウザ）]
      ↕ HTTPS
[Firebase Hosting]  ← Next.js静的エクスポート（out/）を配信
      ↕
[Firebase Authentication]  ← Googleアカウントで認証
      ↕
[Firebase Firestore]  ← データの読み書き（クライアントサイド）
```

### リアルタイム同期の仕組み

複数のデバイス・タブで同時に開いていても、片方での変更がもう片方に自動的に
反映される。これはFirestoreの`onSnapshot`（データの変化を監視し続ける仕組み）
によって実現する。

```
[デバイスA（ブラウザ）]                [デバイスB（ブラウザ）]
      ↕ 書き込み                         ↑ 自動で通知（リアルタイム反映）
      └──────────→ [Firebase Firestore] ─┘
```

同期の対象は次の通り。

| 対象 | 同期する | 理由 |
|------|---------|------|
| メモの位置（x, y） | する | 別デバイスで動かした位置をすぐ確認したい |
| メモのテキスト内容 | する | 編集内容を即時共有したい |
| メモ・つながりの削除 | する | 削除漏れ・重複を防ぐ |
| つながりの構造（リンクの接続先） | する | リスト画面での階層変更（ドラッグ）はlinksデータの書き換えのため |
| パン位置・ズーム倍率 | しない | デバイスごとに見ている範囲が異なるのが自然 |
| リスト画面での根の指定 | しない | 一時的な表示設定のみ（保存しない） |

### 認証フロー

- Googleアカウントでサインイン（Firebase Authentication）
- サインイン後、ユーザーIDに紐づいたボード・データのみ読み書き可能
- 未認証ユーザーはサインイン画面へリダイレクト

> **認証ガードの実装方針**
> 認証ガードは `AuthGuard.tsx`（Client Component）として実装し、`src/app/layout.tsx` から呼び出す。
> `usePathname()` で現在のパスを確認し、`/login` の場合はリダイレクト処理をスキップする。

---

## 4. Firestoreデータモデル

### コレクション構造

```
users/{userId}/
  boards/{boardId}/
    notes/{noteId}
    links/{linkId}
```

### 4-1. boards コレクション（ボード1件分）

| 項目名 | 型 | 内容 |
|--------|-----|------|
| `id` | string | ボードを識別するID |
| `name` | string | ボード名（例: "メインボード"） |
| `skin` | string | デザインスキン（"leaf" / "default" / "cloud"） |
| `isActive` | boolean | 表示中かどうか（削除はisActiveをfalseにする） |
| `createdAt` | Timestamp | 作成日時 |
| `updatedAt` | Timestamp | 最終更新日時 |

### 4-2. notes コレクション（メモ1件分）

| 項目名 | 型 | 内容 |
|--------|-----|------|
| `id` | string | メモを識別するID |
| `text` | string | メモの本文 |
| `x` | number | キャンバス上のX座標 |
| `y` | number | キャンバス上のY座標 |
| `isActive` | boolean | 表示中かどうか（削除はisActiveをfalseにする） |
| `createdAt` | Timestamp | 作成日時 |
| `updatedAt` | Timestamp | 最終更新日時 |

### 4-3. links コレクション（つながり1本分）

| 項目名 | 型 | 内容 |
|--------|-----|------|
| `id` | string | つながりを識別するID |
| `a` | string | 接続元メモのID |
| `b` | string | 接続先メモのID |
| `isActive` | boolean | 有効かどうか（メモ削除時、関連する線も非表示にする） |
| `createdAt` | Timestamp | 接続した日時 |

> **論理削除に関する注意**
> notes・links・boardsはすべて物理削除せず、`isActive`をfalseにすることで「削除」を表現する。
> 一覧表示・つながりの検出・木構造への変換など、すべての処理で必ず `isActive: true` のデータのみを対象とすること。
>
> Firestoreは「削除済みデータ」を自動的に隠す機能を持たない。`isActive: true` の絞り込みは
> 機能を使う側（アプリのコード）が毎回明示的に行う必要がある。

> **削除時の連動処理に関する注意**
> メモを削除（isActive: false）する際、そのメモに関連するlinks（aまたはbがそのメモIDのもの）も
> 自動では削除されない。アプリ側のコードで明示的に「関連するlinksを探して、それも非表示にする」
> 処理を実装する必要がある。

---

## 5. 機能要件

### 5-1. 認証

| 機能 | 仕様 |
|------|------|
| サインイン | Googleアカウントでのサインイン |
| サインアウト | ヘッダーのユーザーアイコンをタップ→メニューからサインアウト（設定画面からも同様に可能） |
| 未認証アクセス | サインイン画面へリダイレクト |

### 5-2. ボード管理

| 機能 | 仕様 |
|------|------|
| ボード切り替え | ヘッダーのドロップダウンでボード名一覧から選択 |
| ボード新規作成 | 設定画面から行う |
| ボード名変更 | 設定画面から行う |
| ボード削除 | 設定画面から行う（論理削除）。最後の1枚は削除不可（常に最低1枚を保持） |
| スキン変更 | 設定画面から行う（ボードごとに保存） |
| メモの一括削除 | 設定画面から行う。現在アクティブなボードのnotes・linksをまとめて論理削除する。確認ポップアップを表示してから実行する |

### 5-3. キャンバス（メモの操作）

| 機能 | 仕様 |
|------|------|
| メモ追加 | 入力欄にテキストを入れて＋ボタン |
| メモ移動 | カードをドラッグ |
| メモ編集 | カードを長押しすると編集モードに入る |
| メモ削除 | カード右上の✕ボタン（論理削除。関連するlinksも合わせて非表示にする） |
| メモをつなぐ | カード縁の丸ハンドルからドラッグして別カードへ |
| つながりを切る（方法①） | 線をタップ/クリックで選択→「✕ 切る」チップを押す |
| つながりを切る（方法②） | コントロールエリアの「切るモード」ボタンを押す→モード中、線を横切るジェスチャーで切断→モード中は他の操作（パン・ドラッグ・つなぐ等）を無効化 |
| パン | 背景をドラッグ（通常モード時のみ） |
| ズーム | ピンチズーム／ホイールズーム |
| カード展開 | クリック/タップで葉っぱ→角丸四角に変形（全カード対応、詳細は2章参照） |
| 重なり防止 | 新規・移動後のメモが他のメモと重ならないよう自動で空きスペースを探す |

### 5-4. リスト（つながりの一覧化）

| 機能 | 仕様 |
|------|------|
| グループ化 | つながっているメモ同士を1つのグループとして表示。単独のメモは「単独のメモ」グループにまとめる |
| 階層表示 | グループ内を木構造（親子関係）で箇条書き表示 |
| デフォルトの根 | 各グループの中で最も古く作成されたメモを根とする |
| 根の変更 | メモを選択し「これを根にする」操作が可能。保存はされず一時的（再訪問でデフォルトに戻る） |
| 階層変更 | リスト上でドラッグし親子関係を変更できる（実データを書き換えるため他デバイスにも同期される） |
| 書き出し | CSV/JSON形式。階層をインデントで表現する形式で書き出し可能（箇条書きとして貼り付けやすい形にする） |

---

## 6. 画面・コンポーネント設計

### 画面一覧

| 画面名 | パス | ファイル |
|--------|------|---------|
| サインイン | `/login` | `src/app/login/page.tsx` |
| キャンバス（メイン） | `/` | `src/app/page.tsx` |
| リスト | `/list` | `src/app/list/page.tsx` |
| 設定 | `/settings` | `src/app/settings/page.tsx` |

> キャンバスとリストは別URLとする（同一URL内のタブ切り替えにはしない）。
> 理由：リロード時にリスト画面の状態を保持できる、ブックマーク可能にするため。
> ボードIDはURLに含めない（選択中のボードは画面を開いている間のみ保持する）。

### 設定画面（/settings）のセクション構成

1. **現在のボードの設定**
   - ボード名の変更
   - スキン選択（葉っぱ／デフォルト／雲）
   - メモの一括削除（確認ポップアップあり）
   - このボードを削除（最後の1枚の場合は非活性）
2. **ボード一覧・管理**
   - 全ボードの一覧表示
   - 新しいボードを作成
3. **アカウント**
   - サインアウト（ヘッダーのユーザーアイコンからも同様に可能）

### コンポーネント構成

```
src/
├── app/
│   ├── layout.tsx                   # ルートレイアウト（AuthGuard含む）
│   ├── page.tsx                     # キャンバス（/）
│   ├── login/
│   │   └── page.tsx                 # サインイン
│   ├── list/
│   │   └── page.tsx                 # リスト
│   └── settings/
│       └── page.tsx                 # 設定
├── components/
│   ├── layout/
│   │   ├── Header.tsx               # ロゴ・ボード切り替えドロップダウン・ユーザーアイコン
│   │   └── NoteInput.tsx            # 「思いついたことをメモする...」入力欄
│   ├── canvas/
│   │   ├── Canvas.tsx               # パン・ズームの土台、全体のまとめ役
│   │   ├── NoteCard.tsx             # メモカード本体（葉っぱ型・展開・ドラッグ）
│   │   ├── LinkLine.tsx             # つながりの線（SVGベジェ曲線）
│   │   └── CanvasControls.tsx       # 右下のコントロール（拡大・縮小・件数・切るモード）
│   ├── list/
│   │   ├── GroupList.tsx            # つながりグループ一覧
│   │   ├── GroupItem.tsx            # 1グループ分の木構造表示
│   │   └── ExportButtons.tsx        # CSV/JSON書き出しボタン
│   └── settings/
│       ├── BoardManager.tsx         # ボード一覧・新規作成・名前変更・削除
│       ├── SkinSelector.tsx         # スキン選択
│       └── DangerZone.tsx           # メモの一括削除・サインアウトなど
├── hooks/
│   ├── useAuth.ts
│   ├── useBoards.ts                 # ボード一覧の取得・切り替え・作成・削除
│   ├── useNotes.ts                  # notesのリアルタイム取得・更新
│   ├── useLinks.ts                  # linksのリアルタイム取得・更新
│   └── useCanvasView.ts             # パン・ズーム状態（ローカルのみ）
├── lib/
│   ├── firebase.ts
│   └── firestore.ts
├── types/
│   └── index.ts
└── utils/
    ├── graphUtils.ts                # つながりのグループ化・木構造変換（buildTree相当）
    └── exportUtils.ts               # CSV/JSON書き出し処理
```

### Next.js App Router の注意点

- Firestoreなどのクライアントサイド処理を含むコンポーネントには必ず先頭に `'use client'` を記述する
- `src/app/layout.tsx` でフォント・グローバルCSSを設定する
- 認証ガード（未認証時のリダイレクト）は `AuthGuard.tsx` に集約し、`/login` は対象外にする

### アニメーション実装上の注意点

- カードの展開・収納アニメーション中は、つながっている線（SVG）の端点位置を
  `requestAnimationFrame` を使ったループで毎フレーム再計算し、追従させる
- この処理はReactの状態変化に依存しないため、`useEffect` 内で開始・終了を管理する

---

## 7. 非機能要件

| 項目 | 要件 |
|------|------|
| レスポンシブ | スマートフォン（375px〜）・タブレット・PCに対応 |
| パフォーマンス | 初回表示3秒以内。ドラッグ操作のなめらかさは実装後に確認し、必要に応じて調整する |
| オフライン | Firestoreのオフラインキャッシュを有効化する |
| 競合処理 | 複数デバイスで同時編集した場合はLast Write Wins（後から書き込まれた内容が反映される）。競合検知・警告は行わない |
| セキュリティ | Firestoreセキュリティルールで自分のデータのみ読み書き可能に制限 |
| 環境変数 | FirebaseのAPIキーは`.env`ファイルで管理し、リポジトリに含めない |

> **LWWの粒度に関する注意**
> 書き込みは必ずフィールド単位の`updateDoc`（変更したフィールドのみを指定する部分更新）で行う。
> ドキュメント全体を上書きする`setDoc`は使わない。
>
> これによりLast Write Winsはフィールド単位で成立する。例えば、あるデバイスでメモのテキストを
> 編集している間に、別デバイスで同じメモの位置（x, y）を移動しても、両方の変更が保持される
> （後勝ちになるのはテキストならテキスト同士、位置なら位置同士の間のみ）。`setDoc`でドキュメント
> 全体を上書きすると、自分が触っていないフィールドまで巻き戻してしまい、この前提が崩れる。

### Firestoreセキュリティルール

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

---

## 8. プロジェクト構成

```
yggd-memo/
├── public/
│   ├── favicon.ico
│   └── logo-mask.png          # ヘッダーロゴ（mask方式・スキンごとに色が変わる）
├── src/
│   └── app/ 他（セクション6参照）
├── docs/
│   ├── requirements.md         ← 本ファイル
│   ├── status.md               ← 実装進捗チェックリスト
│   └── constraints.md          ← NEVERルール
├── AGENTS.md
├── CONTRIBUTING.md
├── README.md
├── .env.local                  # Gitに含めない
├── .env.example
├── .gitignore
├── firebase.json                # Hostingのpublicディレクトリを "out" に設定する
├── .firebaserc
├── firestore.rules
├── next.config.ts                # output: 'export' を設定する
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

### next.config.ts の設定

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',      // 静的エクスポートを有効化
  trailingSlash: true,   // Firebase Hostingとの互換性のため
  images: {
    unoptimized: true,   // 静的エクスポート時はNext.js画像最適化を無効化
  },
}

export default nextConfig
```

### firebase.json の設定

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
  }
}
```

---

## 9. 環境変数（.env.example）

Next.jsではクライアントサイドで使う環境変数に `NEXT_PUBLIC_` プレフィックスが必要。

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

> Yggd-memo用に、ハビットトラッカーとは別の新しいFirebaseプロジェクトを作成して使用する。

---

## 10. デザイン仕様（docs/design-mockup.html より）

> アプリ名は「Yggd-memo」のまま維持する（モックアップ内の「紡 — つむぐメモ」は旧仮称）。

### フォント

- **見出し・ブランド**: `"Zen Old Mincho"` (serif) — CSS変数 `--display`
- **UIテキスト全般**: `"Zen Kaku Gothic New"` (sans-serif) — CSS変数 `--gothic`
- Google Fonts より読み込む（`wght@400;700`）

### スキンシステム

スキンは CSS カスタムプロパティで実装する。`:root` が葉っぱスキン（デフォルト）、`.skin-default` と `.skin-cloud` クラスが変数を上書きする。スキンクラスはキャンバスラッパー要素に適用し、子要素（カード・SVG線）が変数を継承する。

#### 葉っぱ（`:root` / `.skin-leaf`）— ダーク緑

| 変数 | 値 | 用途 |
|---|---|---|
| `--ink` | `#E7EFE7` | テキスト色 |
| `--ink-soft` | `#8DA593` | 補助テキスト |
| `--paper` | `#173524` | カード基色 |
| `--field` | `#08160D` | キャンバス背景 |
| `--field-dot` | `rgba(150,210,160,.07)` | ドットグリッド色 |
| `--accent-rgb` | `46,167,99` | アクセント（rgba用） |
| `--dusk` | `#2EA763` | アクセント |
| `--thread` | `#5E8369` | 接続線色 |
| `--ambient-1` | `rgba(46,167,99,.18)` | 環境光グロー |
| `--card-fill` | `linear-gradient(150deg, color-mix(in srgb, #173524 84%, #79cf94 16%), #173524 58%)` | カード背景グラデーション |
| `--card-filter` | `drop-shadow(0 3px 5px rgba(0,0,0,.5)) drop-shadow(0 0 1px rgba(150,210,160,.5))` | カード影 |
| `--header-grad` | `linear-gradient(180deg, #0A4A22, #003A17)` | ヘッダー背景 |
| `--canvas-image` | `radial-gradient(var(--field-dot) 1.4px, transparent 1.4px)` | キャンバスドットパターン |
| `--canvas-size` | `26px 26px` | ドットパターンサイズ |

#### デフォルト（`.skin-default`）— ダーク藍

| 変数 | 値 |
|---|---|
| `--ink` | `#E8EAF2` |
| `--paper` | `#23262F` |
| `--field` | `#14151A` |
| `--field-dot` | `rgba(185,193,225,.07)` |
| `--accent-rgb` | `124,140,240` |
| `--dusk` | `#7C8CF0` |
| `--thread` | `#8089A8` |
| `--ambient-1` | `rgba(124,140,240,.14)` |
| `--card-fill` | `linear-gradient(150deg, color-mix(in srgb, #23262F 88%, #8c96d8 12%), #23262F 60%)` |
| `--card-filter` | `drop-shadow(0 3px 6px rgba(0,0,0,.5))` |
| `--header-grad` | `linear-gradient(180deg, #2A2D38, #1A1C24)` |

#### 雲（`.skin-cloud`）— ライト青

| 変数 | 値 |
|---|---|
| `--ink` | `#33475A` |
| `--paper` | `#FFFFFF` |
| `--field` | `#9FCBEC` |
| `--field-dot` | `rgba(40,100,160,.12)` |
| `--accent-rgb` | `42,118,196` |
| `--dusk` | `#2C7BC6` |
| `--thread` | `#5E97CF` |
| `--ambient-1` | `rgba(255,255,255,.6)` |
| `--card-fill` | `linear-gradient(180deg, #FFFFFF, #E4F0FB)` |
| `--card-filter` | `drop-shadow(0 6px 11px rgba(40,85,130,.34)) drop-shadow(0 0 0.8px rgba(40,95,150,.6))` |
| `--header-grad` | `linear-gradient(180deg, #EAF5FF, #D2E8FB)` |
| `--canvas-image` | `linear-gradient(180deg, #7FB6E6 0%, #9ECAED 50%, #BCDDF6 100%)` | キャンバス空グラデーション |
| `--canvas-size` | `auto` |

### キャンバス背景

- 葉っぱ・デフォルト: `background-color: var(--field)` + ドットグリッド `radial-gradient(var(--field-dot) 1.4px, transparent 1.4px)` / `26px 26px`
- 雲: `background-color: var(--field)` + 空グラデーション `linear-gradient(180deg, #7FB6E6 0%, #9ECAED 50%, #BCDDF6 100%)`
- 右上に環境光グロー（`radial-gradient(circle, var(--ambient-1), transparent 68%)`）を重ねる

### カード

- `clip-path: var(--card-clip)` でスキン別形状（葉っぱ／角丸四角／雲）
- `background: var(--card-fill)` でグラデーション塗り
- `filter: var(--card-filter)` でドロップシャドウ
- テキスト色: `color: var(--ink)`
- ボーダーなし（影のみで立体感を表現）
- 接続ターゲット時: フィルターに `drop-shadow(0 0 9px rgba(var(--accent-rgb),.85))` を追加

### 接続線（SVG）

- 通常: `stroke: var(--thread)`, strokeWidth 2
- 選択時: `stroke: var(--dusk)`, strokeWidth 3

### クリップパス形状

モックアップの25点ポリゴンを参照（現行の12点ポリゴンより有機的）。今後のタスクで更新予定。

### ヘッダー

- `background: var(--header-grad)` でスキン別グラデーション
- テキスト色: `var(--ink)`
- 今後のタスクで実装予定
