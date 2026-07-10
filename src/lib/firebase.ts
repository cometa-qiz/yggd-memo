import { initializeApp, getApps } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// App Check（reCAPTCHA v3）をブラウザ環境のみで初期化する。
// - Next.js 静的ビルド時（Node.js）は window/reCAPTCHAスクリプトが存在しないため呼ばない
// - サイトキー未設定（Firebaseコンソール側の登録前など）の場合は初期化をスキップする
//   （docs/quickstart.md STEP 2-6 記載の手順でコンソール登録後、環境変数を設定すること）
// - 開発環境では固定のデバッグトークン（NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN）を使う。
//   `true` を指定するとページ読み込みのたびに新しいトークンがランダム生成され、
//   Firebaseコンソールに登録しても次の読み込みで別物になり検証が通らないため、
//   固定の文字列をあらかじめ発行してコンソールに1回だけ登録する運用にしている。
function initAppCheck() {
  if (typeof window === "undefined") return;

  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) {
    console.warn(
      "[firebase] NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY が未設定のため App Check を初期化しません"
    );
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (!debugToken) {
      console.warn(
        "[firebase] NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN が未設定のため、読み込みごとに新しいデバッグトークンがランダム生成されます（Firebaseコンソールへの登録が定着しません）"
      );
    }
    (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken || true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

initAppCheck();

export const auth = getAuth(app);

// ブラウザ環境のみ IndexedDB 永続化を有効化する。
// - Next.js 静的ビルド時（Node.js）は IndexedDB が存在しないため getFirestore() を使用
// - initializeFirestore は getFirestore より先に、かつ1回だけ呼ぶ必要があるため
//   try/catch でガードし、既初期化済みの場合は getFirestore() にフォールバックする
function initDb() {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db = initDb();
