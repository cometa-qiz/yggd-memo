# AIエージェント作業依頼テンプレート

Claude Code にそのまま貼り付けて使う。

---

## 作業開始時（最初の1回）

```
以下の順番でドキュメントをすべて読んでください。

1. AGENTS.md
2. docs/constraints.md
3. CONTRIBUTING.md
4. docs/requirements.md
5. docs/status.md

読み終えたら「読み込み完了」と報告し、
docs/status.md で最初の未完了タスク（[ ]）が何かを教えてください。
実装はまだ始めないでください。
```

---

## 毎回の作業依頼（1タスクずつ）

```
docs/status.md、docs/requirements.md、AGENTS.md、CONTRIBUTING.md、docs/constraints.md を確認した上で、
未完了タスクを1つだけ実装してください。

実装が完了したら以下を報告してください。

1. 実装したタスク名
2. 変更・作成したファイル一覧
3. 確認コマンドの実行結果（pnpm build / pnpm lint など）
4. 次の未完了タスク名

実装は1タスクのみ。次のタスクには進まないこと。
```

---

## Phaseの完了確認時

```
docs/status.md の PhaseX の ✅ 完了確認 をすべて実行して結果を報告してください。
すべてパスしたら status.md の該当チェックボックスを更新してください。
```

---

## エラーが出たとき

```
以下のエラーが発生しました。原因を特定して修正してください。
修正後に pnpm build が成功することを確認してください。

--- エラーメッセージ ---
（ここにエラーを貼り付ける）
```

---

## 途中から再開するとき

```
AGENTS.md・docs/constraints.md・docs/status.md を読んで、
現在の進捗状況を確認してください。
どのPhaseのどのタスクから再開すべきか教えてください。
```
