import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "风格画室 · Visual Style Atelier",
  description:
    "将照片转换为精选艺术风格并生成对照成品。Transform photos into curated art styles and comparison images.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
