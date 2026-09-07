import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "风格画室 · Visual Style Atelier",
  description:
    "将照片转换为精选艺术风格并生成对照成品。Transform photos into curated art styles and comparison images.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <Script nonce={nonce} src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}
