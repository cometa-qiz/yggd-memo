import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New, Zen_Old_Mincho } from "next/font/google";
import "./globals.css";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/layout/Header";
import { AppProviders } from "@/components/AppProviders";

const zenGothic = Zen_Kaku_Gothic_New({
  variable: "--gothic",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const zenMincho = Zen_Old_Mincho({
  variable: "--display",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Yggd-memo",
  description: "メモをつなげて、考えを整理する",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${zenGothic.variable} ${zenMincho.variable} h-full antialiased`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col">
          <AppProviders>
            <Header />
            <AuthGuard>{children}</AuthGuard>
          </AppProviders>
        </body>
    </html>
  );
}
