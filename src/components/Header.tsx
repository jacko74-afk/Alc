"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-gold-500/20 bg-espresso-950 text-cream-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="group">
          <p className="text-[10px] tracking-[0.38em] text-gold-400">
            DUTY FREE SPIRITS
          </p>
          <p className="font-display text-2xl font-semibold tracking-tight text-cream-50 group-hover:text-gold-300">
            면세점 주류 비교
          </p>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-cream-200">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 hover:bg-white/5 hover:text-gold-300"
          >
            셀러
          </Link>
          <Link
            href="/admin"
            className="rounded-md border border-gold-500/40 px-3 py-1.5 text-gold-300 hover:bg-gold-500/10"
          >
            관리자
          </Link>
        </nav>
      </div>
    </header>
  );
}
