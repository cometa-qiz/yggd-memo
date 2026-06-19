# CONTRIBUTING.md

このプロジェクトへの変更・実装作業における Git/GitHub の運用ルールを定義する。

---

## ブランチ構成

| ブランチ | 役割 | 直接コミット |
|---------|------|------------|
| `main` | 常に動く状態を保つ本番ブランチ | **禁止** |
| `TYPE/english-brief-description` | 機能追加・修正作業用ブランチ | OK |

---

## コミットメッセージ規則

**形式**: `TYPE: 日本語メッセージ`

- `:` は半角コロン
- `:` の後には半角スペースを1つ入れる

| TYPE | 使うとき | 例 |
|------|---------|-----|
| `feat` | 新機能の追加 | `feat: メモのドラッグ接続機能を追加` |
| `fix` | バグ修正 | `fix: つながり検出のズレを修正` |
| `style` | 見た目・デザインの変更 | `style: カード展開アニメーションを調整` |
| `refactor` | 動作を変えないコード整理 | `refactor: useNotesフックを整理` |
| `docs` | ドキュメントの変更 | `docs: status.mdのPhase1を完了に更新` |
| `chore` | 設定・環境構築 | `chore: Firebase初期設定を追加` |

**コミットのタイミング**:
- `status.md` の1タスクが完了するごとにコミットする
- 複数タスクをまとめて1コミットにしない
- 動作確認が取れた状態でのみコミットする

---

## ブランチ・PR命名規則

| 項目 | 形式 | 例 |
|------|------|----|
| ブランチ名 | `TYPE/english-brief-description` | `feat/note-connection-drag` |
| PRタイトル | ブランチ名と同じ | `feat/note-connection-drag` |

- `TYPE` はコミットメッセージと同じ種類（`feat` / `fix` / `style` / `refactor` / `docs` / `chore`）
- `english-brief-description` は英語・ハイフン区切り・小文字

---

## プルリクエスト（PR）の説明

- **日本語のMarkdown形式**で記載する
- 図解が必要な場合は **Mermaid記法** を使う
- 以下のテンプレートに従うこと

```markdown
## 変更内容
<!-- 何をしたかを日本語で説明する -->

## 変更理由
<!-- なぜこの変更が必要だったかを説明する -->

## 動作確認
<!-- 確認した内容をチェックリスト形式で記載する -->
- [ ] スマホで表示を確認した
- [ ] PCで表示を確認した
- [ ] Firestoreにデータが保存されることを確認した

## 図解（必要な場合）
<!-- 処理の流れや構造をMermaid記法で記載する -->
```

---

## 一連の作業フロー

実装作業は必ず以下の順序で行うこと。

```powershell
# 1. mainを最新にする
git switch main
git pull origin main

# 2. 作業ブランチを作成して移動する
# 例: git switch -c feat/note-connection-drag
git switch -c TYPE/your-task-name

# 3. 依存パッケージをインストールする（npmは使わない）
pnpm install

# 4. 実装する（status.mdの1タスクごとにコミット）
git add .
git commit -m "feat: メモのドラッグ接続機能を追加"

# 5. リモートにプッシュする
# 例: git push origin feat/note-connection-drag
git push origin TYPE/your-task-name

# 6. GitHubでPRを作成する
#    タイトル: TYPE/your-task-name
#    説明: 上記テンプレートに従い日本語Markdownで記載

# 7. PRをmainにマージする（GitHub上で操作）

# 8. mainに戻りローカルを最新にする
git switch main
git pull origin main

# 9. 作業ブランチを削除する
# 例: git branch -d feat/note-connection-drag
git branch -d TYPE/your-task-name
```

---

## 絶対ルール

- `.env*` / `*.sqlite*` / `dist/` / `node_modules/` は絶対にコミットしないこと（→ `docs/constraints.md` 参照）
- `main` ブランチへの直接コミット・プッシュは禁止。必ずブランチを作成しPRを経由すること
- コミット前に `git status` で変更ファイルを必ず確認すること
