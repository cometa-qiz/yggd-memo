# Yggd-memo

メモをつなげて、考えを整理する Web アプリです。  
マインドマップ形式でメモ同士をつなぎ、つながりをアウトライン（箇条書き）として書き出せます。

**公開 URL：** https://yggd-memo.web.app

---

## 主な機能

- **メモの作成・編集・削除** — キャンバス上にメモカードを配置
- **つなぐ・切る** — メモ同士を線でつなぎ、マインドマップ形式で関係を可視化
- **アウトライン表示・エクスポート** — つながりを木構造の箇条書きとして表示し、CSV / JSON で書き出し
- **ボード管理** — 複数ボードを作成・切り替え
- **3種類のスキン** — 葉っぱ / デフォルト / 雲
- **オフライン対応** — Firestore オフラインキャッシュによりネットワーク切断中も閲覧・操作が可能
- **スマホ・PC 対応** — ポインターイベント API によるタッチ操作対応

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 15 (App Router, 静的エクスポート) / TypeScript / Tailwind CSS |
| バックエンド・DB | Firebase Firestore |
| 認証 | Firebase Authentication (Google ログイン) |
| ホスティング | Firebase Hosting |

---

## ローカル起動方法

### 1. リポジトリをクローン

```bash
git clone https://github.com/cometa-qiz/yggd-memo.git
cd yggd-memo
```

### 2. 依存パッケージをインストール

```bash
pnpm install
```

### 3. Firebase プロジェクトの設定

[Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作成し、  
Firestore・Authentication（Google プロバイダ）を有効にしてください。

`.env.example` をコピーして `.env.local` を作成し、各値を設定します。

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. 開発サーバーを起動

```bash
pnpm dev
```

ブラウザで http://localhost:3000 を開いてください。
