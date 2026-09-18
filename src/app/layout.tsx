import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { AgeGate } from "@/components/AgeGate";
import { Header } from "@/components/Header";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "면세점 주류 비교",
  description: "롯데·신라·신세계 인터넷 면세점 위스키 가격 비교",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${display.variable} ${sans.variable} font-sans`}>
        <AgeGate>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-12 text-xs leading-5 text-espresso-700/70">
            지나친 음주는 건강을 해칩니다. 이 사이트의 가격은 성인인증 후 보이는
            참고용 금액이며, 실제 판매가·재고는 각 면세점에서 확인하세요.
            쿠폰·적립금·카드 할인은 포함하지 않습니다. 귀국 시 주류 면세 한도는
            2병, 총 2L, US$400 이하입니다.
          </footer>
        </AgeGate>
      </body>
    </html>
  );
}
