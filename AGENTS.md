# AGENTS.md

## このプロジェクトについて

思いついたことをすぐにメモでき、メモ同士のつながりを視覚的に確認しながら、
最終的には箇条書き（アウトライン）としてまとめて書き出せるWebアプリケーション。
Next.js + React + TypeScript + Firebase で構築し、Firebase Hosting で公開する。

---

## ドキュメント

| ファイル | 内容 |
|---------|------|
| `docs/agent_prompt.md` | 📋 作業依頼テンプレート（毎回ここから貼り付ける） |
| `docs/requirements.md` | 技術仕様・データモデル・機能要件・コンポーネント設計 |
| `docs/status.md` | 実装進捗チェックリスト（Phase 0〜9） |
| `docs/glossary.md` | 📖 専門用語集（非エンジニア向け） |
| `docs/constraints.md` | ⛔ NEVERルール（絶対禁止事項） |
| `docs/review_checklist.md` | ✅ PRレビューチェックリスト |
| `CONTRIBUTING.md` | Git/GitHub運用ルール・ブランチ戦略・PRテンプレート |

---

## 開発環境

- **OS**: Windows
- **シェル**: PowerShell（コマンドは必ずPowerShell向けの構文で生成すること）
- **注意点**:
  - パス区切り文字はバックスラッシュ（`\`）を使用すること
  - `&&` によるコマンド連結は使用しないこと（PowerShellでは `;` または別行で実行）
  - `mkdir -p` の代わりに `New-Item -ItemType Directory -Force` を使用すること
  - スクリプトを作成する場合は `.sh` ではなく `.ps1` 形式にすること

---

## エージェントへの指示

1. **作業前に必ず以下の順序でドキュメントを読むこと**
   1. `docs/constraints.md`（NEVERルール）
   2. `CONTRIBUTING.md`（Git/GitHub運用ルール）
   3. `docs/requirements.md`（技術仕様）
   4. `docs/status.md`（現在の進捗）
2. `docs/status.md` の未完了タスク（`[ ]`）を上から順番に実装すること
3. タスクが完了したら該当行を `[x]` に更新すること
4. **1つのPhaseが完了して動作確認が取れてから次のPhaseに進むこと**
5. コードを変更する場合は既存ファイルを確認してから編集すること（上書き厳禁）
6. `notes` / `links` / `boards` はすべて論理削除（`isActive`）方式である。一覧表示・つながりの検出・
   木構造への変換・書き出し処理では必ず `isActive: true` のデータのみを対象にすること

---

## 技術スタック（概要）

- **フロントエンド**: Next.js + TypeScript（App Router・Static Export）
- **スタイリング**: Tailwind CSS + 素のCSS（カードの`clip-path`・展開アニメーション）
- **アニメーション**: CSS Transitionのみ（追加ライブラリは導入しない）
- **データベース**: Firebase Firestore
- **認証**: Firebase Authentication（Google Sign-in）
- **ホスティング**: Firebase Hosting（`out/` ディレクトリを配信）

詳細は `docs/requirements.md` を参照すること。
