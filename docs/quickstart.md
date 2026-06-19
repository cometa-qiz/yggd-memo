# クイックスタートガイド
## AIエージェントに作業を頼む前にやること

> 所要時間の目安: 約30〜60分
> 難しいコマンドは一切ありません。画面の指示に従うだけでOKです。

---

## 前提条件

このガイドは、Node.js・pnpm・Git・GitHubアカウントのセットアップが
**すでに完了していること**を前提にしている（habit-trackerで一度行った環境構築は
パソコン単位の作業のため、Yggd-memoのために再度行う必要はない）。

未セットアップの場合は、先に以下を済ませてから本ガイドに進むこと。

- Node.js（LTS版）のインストール：[https://nodejs.org](https://nodejs.org)
- pnpmの有効化：PowerShellで `corepack enable pnpm`
- Gitのインストール：[https://git-scm.com](https://git-scm.com)
- Gitの初期設定：`git config --global user.name "名前"` / `git config --global user.email "メールアドレス"`
- GitHubアカウントの作成：[https://github.com](https://github.com)

---

## 全体の流れ

```
STEP 1  GitHubにリポジトリを作る
STEP 2  Firebaseのプロジェクトを作る
STEP 3  プロジェクトをパソコンに用意する
STEP 4  Claude Codeに渡す準備をする
```

---

## STEP 1 ｜ GitHubにリポジトリを作る

「リポジトリ」とは、プロジェクトのファイルを保管するGitHub上の場所です。

1. GitHubにサインインする
2. 右上の「＋」ボタン →「New repository」をクリック
3. 以下の通りに設定する

| 項目 | 設定値 |
|------|--------|
| Repository name | `yggd-memo` |
| Visibility | Public（誰でも見られる） |
| Add a README file | チェックしない |

4. 「Create repository」をクリック
5. 作成後の画面に表示される URL をコピーしておく
   （例: `https://github.com/あなたのユーザー名/yggd-memo.git`）

---

## STEP 2 ｜ Firebaseのプロジェクトを作る

Firebaseはデータの保存と認証を担当します。Googleアカウントがあればすぐ使えます。
habit-trackerとは**別の新しいプロジェクト**として作成します。

---

### 2-1. プロジェクトを作成する

1. [https://console.firebase.google.com](https://console.firebase.google.com) を開く
2. Googleアカウントでサインイン
3. 「プロジェクトを追加」をクリック
4. プロジェクト名に `yggd-memo` と入力
5. Google アナリティクスは「有効にする」のチェックを外してOK
6. 「プロジェクトを作成」をクリック

---

### 2-2. Googleサインインを有効にする

1. 左メニューの「Authentication」をクリック
2. 「始める」をクリック
3. 「Sign-in method」タブをクリック
4. 「Google」をクリック
5. 右上のスイッチを「有効」にする
6. プロジェクトのサポートメールを選択して「保存」

---

### 2-3. データベースを有効にする

1. 左メニューの「Firestore Database」をクリック
2. 「データベースの作成」をクリック
3. 「本番環境モード」を選択して「次へ」
4. ロケーションは `asia-northeast1`（東京）を選択して「有効にする」

---

### 2-4. ホスティングを有効にする

1. 左メニューの「Hosting」をクリック
2. 「始める」をクリック
3. 画面の手順が表示されるが、**今はそのまま「次へ」「完了」で進めてOK**
   （実際のデプロイはClaude Codeに依頼します）

---

### 2-5. アプリの設定情報をコピーする（重要）

この情報はあとで `.env.local` に貼り付けます。

1. 左メニュー上部の歯車アイコン →「プロジェクトの設定」をクリック
2. 「全般」タブの下にある「マイアプリ」セクションまでスクロール
3. 「＋アプリを追加」→ ウェブ（`</>`）アイコンをクリック
4. アプリのニックネームに `yggd-memo-web` と入力
5. 「Firebase Hosting も設定する」はチェックしてOK
6. 「アプリを登録」をクリック
7. 以下のようなコードが表示されるのでコピーしておく

```javascript
// この中の値をあとで使います
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "yggd-memo-xxxxx.firebaseapp.com",
  projectId: "yggd-memo-xxxxx",
  storageBucket: "yggd-memo-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## STEP 3 ｜ プロジェクトをパソコンに用意する

---

### 3-1. ZIPファイルを展開する

1. 受け取った `yggd-memo-docs.zip` を展開する
2. 展開してできた `yggd-memo` フォルダを作業したい場所に置く
   （例: `D:\Dドキュメント\LLM\projects\yggd-memo`）

---

### 3-2. GitHubと紐づける

PowerShellで以下を順番に入力する。
`yggd-memo` フォルダのパスは自分の環境に合わせて変える

```powershell
# yggd-memoフォルダに移動する
cd D:\Dドキュメント\LLM\projects\yggd-memo

# Gitを初期化する
git init

# .gitignore を作成し、.env.local を除外対象に登録する
# （これより前にコミットすると .env.local が漏れる恐れがあるため必ず先に作る）
Set-Content -Path .gitignore -Value ".env.local`n.env`nnode_modules/`nout/`n.next/" -Encoding UTF8

# .gitignore に .env.local が含まれているか確認する
Get-Content .gitignore

# すべてのファイルをステージする
git add .

# .env.local がステージされていないことを確認する（出てこなければOK）
git status

# 最初のコミットをする
git commit -m "chore: プロジェクト初期設定"

# mainブランチに切り替える
git branch -M main

# GitHubと紐づける（URLはSTEP 1でコピーしたもの）
git remote add origin https://github.com/あなたのユーザー名/yggd-memo.git

# GitHubにプッシュする
git push -u origin main
```

> ⚠️ この時点の `.gitignore` は仮のものです。Phase 0で `pnpm create next-app` を実行すると、
> Next.js標準の `.gitignore` が生成され直すことがあります。その際も `.env.local` が
> 必ず含まれているか、`Get-Content .gitignore` で確認すること。

---

### 3-3. 環境変数ファイルを作る

`yggd-memo` フォルダの中に `.env.local` という名前のファイルを作り、以下を貼り付ける。
各値はSTEP 2-5でコピーした `firebaseConfig` の中身に置き換える

```
NEXT_PUBLIC_FIREBASE_API_KEY=ここにapiKeyの値
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ここにauthDomainの値
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ここにprojectIdの値
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ここにstorageBucketの値
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=ここにmessagingSenderIdの値
NEXT_PUBLIC_FIREBASE_APP_ID=ここにappIdの値
```

> ⚠️ `.env.local` はGitにコミットしないこと。`.gitignore` に記載済みなので自動で除外されます。

> ⚠️ 貼り付けたあと、`=` の前後に余計な空白が無いか、値が途中で改行されて
> 切れていないかを必ず確認すること（コピー時のミスでFirebase接続エラーの
> 原因になりやすい箇所）。1行＝1つの値になっていることを目で確認する。

---

## STEP 4 ｜ Claude Codeに渡す準備をする

ここまで完了したら、Claude Codeに作業を頼む準備が整いました。

---

### 4-1. Claude Codeを開く

1. PowerShellで `yggd-memo` フォルダに移動する
2. `claude` コマンドでClaude Codeを起動する

---

### 4-2. 最初の指示を送る

`docs/agent_prompt.md` の **「作業開始時」** のテンプレートをコピーしてClaude Codeのチャット欄に貼り付け、Enterを押す。

以降の作業は `docs/agent_prompt.md` のテンプレートを場面に応じて使い分ける。

---

## うまくいかないときは

| 症状 | 確認すること |
|------|------------|
| `node -v` でエラーが出る | Node.jsのインストールをやり直す |
| `pnpm -v` でエラーが出る | PowerShellを閉じて再度開いてから試す |
| `git push` でエラーが出る | GitHubにサインインできているか確認する |
| Claude Codeがエラーを出す | エラーメッセージをそのままClaude Codeに貼り付けて「これを直して」と送る |

---

> 💡 **困ったときのコツ**
> エラーが出ても焦らなくてOK。エラーメッセージをClaude Codeに貼り付けて「これが出て困っています」と送れば解決してくれます。
