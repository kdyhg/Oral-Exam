import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "미적분 수학개념 도슨트",
  description: "2026학년도 2학년 2학기 미적분 구술 수행평가 운영 도구",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#081426",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
