"use client";

import { Money } from "@/components/Money";
import { ProductImage } from "@/components/ProductImage";
import { PriceModeLegend } from "@/components/PriceModeLegend";
import { loadLiveCatalog } from "@/lib/store";
import type { Product } from "@/lib/types";
import { MALLS } from "@/lib/types";
import { useUsdKrwRate } from "@/lib/useUsdKrwRate";
import { lowestFor, originalUsd } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const rate = useUsdKrwRate();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);

  useEffect(() => {
    void loadLiveCatalog().then((catalog) => {
      setProduct(catalog.products.find((item) => item.id === params.id) ?? null);
    });
  }, [params.id]);

  if (product === undefined) {
    return <p className="text-sm text-espresso-700/70">불러오는 중…</p>;
  }
  if (!product) {
    return (
      <p className="text-sm text-espresso-700/70">
        상품을 찾을 수 없습니다.{" "}
        <Link href="/" className="underline">
          목록으로
        </Link>
      </p>
    );
  }

  const best = lowestFor(product);

  return (
    <div>
      <Link href="/" className="text-sm text-wine-700 hover:underline">
        ← 셀러로
      </Link>
      <div className="mt-4 grid gap-6 md:grid-cols-[200px_1fr]">
        <ProductImage product={product} className="h-72 w-full md:h-80" />
        <div>
          <p className="text-[11px] tracking-[0.28em] text-gold-700">{product.brand}</p>
          <h1 className="font-display mt-1 text-3xl font-semibold">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-espresso-700">
            {product.volumeMl}ml · 업데이트 {product.updatedAt}
            {product.isSamplePrice ? " · 샘플 가격" : ""}
          </p>
          <div className="mt-4">
            <PriceModeLegend />
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {MALLS.map((mall) => {
          const listing = product.listings[mall.id];
          if (!listing) {
            return (
              <div
                key={mall.id}
                className="panel p-5 text-sm text-espresso-700/40"
              >
                {mall.label} 미입점
              </div>
            );
          }
          const original = originalUsd(listing);
          const isBest = best?.mallId === mall.id;
          return (
            <div
              key={mall.id}
              className={`panel p-5 ${isBest ? "ring-1 ring-gold-500" : ""}`}
            >
              <h2 className="font-display text-xl">{mall.label}</h2>
              {isBest ? (
                <p className="mt-1 text-xs text-wine-700">최저 성인가</p>
              ) : null}
              <p className="mt-4 text-xs tracking-wide text-espresso-700/60">원래가</p>
              <p className="text-lg font-medium text-espresso-700/50">
                {original != null ? <Money usd={original} rate={rate} strike /> : "—"}
              </p>
              <p className="mt-3 text-xs tracking-wide text-espresso-700/60">성인인증가</p>
              <p className="text-2xl font-semibold text-wine-700">
                <Money usd={listing.adultOnly.priceUsd} rate={rate} />
              </p>
              <a
                href={listing.url}
                target="_blank"
                rel="noreferrer"
                className="btn-wine mt-5"
              >
                {mall.label}에서 확인
              </a>
            </div>
          );
        })}
      </div>
      <section className="mt-8 rounded-xl border border-gold-400/20 bg-espresso-900 p-5 text-sm text-cream-200/80">
        <h2 className="font-display text-lg text-gold-300">면세 반입 한도 (귀국 시)</h2>
        <p className="mt-2">
          주류는 일반 면세 한도 US$800과 별도로, 2병·총 2L·US$400 이하까지
          면세입니다. 초과분은 세관 신고 대상입니다.
        </p>
      </section>
    </div>
  );
}
