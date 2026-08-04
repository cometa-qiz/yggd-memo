import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

// 本番ビルド（`pnpm build` = `next build`）実行時のみ、App Checkのデバッグトークンが
// .env.local に残っていないかを機械的にチェックする（design-review_2026-07.md R4-2）。
// Next.jsはnext.config.tsの評価前に.env.localを読み込むため、ここでprocess.envを参照できる。
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN) {
    throw new Error(
      "[next.config.ts] NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN が設定された状態のため本番ビルドを中止しました。\n" +
        "  .env.local からこの行の値を空にしてから `pnpm build` を実行してください（ローカル開発再開時は元の値に戻してOK）。\n" +
        "  詳細: docs/quickstart.md の「本番デプロイ前の確認」を参照。"
    );
  }
  return nextConfig;
}
