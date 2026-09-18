"use client";

import { CompareTable } from "@/components/CompareTable";
import { PriceModeLegend } from "@/components/PriceModeLegend";
import { SearchFilter } from "@/components/SearchFilter";
import { loadLiveCatalog } from "@/lib/store";
import type { Category, Product } from "@/lib/types";
import { productLowestPrice } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function HomePage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");

  useEffect(() => {
    void loadLiveCatalog().then((catalog) => {
      setItems(catalog.products);
      setSavedAt(catalog.savedAt);
      setLoaded(true);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((p) => (category === "all" ? true : p.category === category))
      .filter((p) =>
        q ? `${p.brand} ${p.name}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => productLowestPrice(a) - productLowestPrice(b));
  }, [items, query, category]);

  const savedLabel = savedAt
    ? new Date(savedAt).toLocaleString("ko-KR")
    : null;

  return (
    <div>
      <section className="overflow-hidden rounded-2xl border border-gold-400/25 bg-espresso-950 px-6 py-8 text-cream-50 shadow-bottle md:px-10">
        <p className="text-[11px] tracking-[0.38em] text-gold-400">
          LOTTE · SHILLA · SHINSEGAE
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold md:text-4xl">
          세 면세점 위스키를 한 셀러에서
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-cream-200/75">
          만 19세 확인 후 성인인증가를 비교합니다. 비교 가격은 관리자가 저장한
          JSON 파일에서 불러옵니다.
        </p>
      </section>
      <div className="mt-5">
        <PriceModeLegend />
      </div>
      {!loaded ? (
        <p className="mt-8 text-sm text-espresso-700/70">저장된 가격을 불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-gold-400/25 bg-cream-50 px-6 py-10 text-center">
          <p className="font-display text-xl text-espresso-900">저장된 비교 가격이 없습니다</p>
          <p className="mt-2 text-sm text-espresso-700">
            관리자에서 실제 가격을 수집한 뒤 JSON 파일로 저장하면 여기에 표출됩니다.
          </p>
          <Link href="/admin" className="btn-wine mt-5 inline-flex">
            관리자로 가기
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-espresso-700/60">
            관리자 JSON {items.length}개
            {savedLabel ? ` · 저장 ${savedLabel}` : ""} 를 불러왔습니다.
          </p>
          <SearchFilter
            query={query}
            category={category}
            onQuery={setQuery}
            onCategory={setCategory}
          />
          <CompareTable products={filtered} />
        </>
      )}
    </div>
  );
}
