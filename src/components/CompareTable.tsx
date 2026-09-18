"use client";

import { Money } from "@/components/Money";
import { ProductImage } from "@/components/ProductImage";
import type { MallId, Product } from "@/lib/types";
import { MALLS } from "@/lib/types";
import { useUsdKrwRate } from "@/lib/useUsdKrwRate";
import { lowestFor, originalUsd } from "@/lib/utils";
import Link from "next/link";

function PriceCell({
  product,
  mallId,
  rate,
}: {
  product: Product;
  mallId: MallId;
  rate: number;
}) {
  const listing = product.listings[mallId];
  if (!listing) {
    return <span className="text-espresso-700/40">미입점</span>;
  }
  const adultBest = lowestFor(product);
  const adultLow = adultBest?.mallId === mallId;
  const original = originalUsd(listing);

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-md p-1 hover:bg-gold-50"
    >
      <p className="text-[11px] text-espresso-700/45">
        원래가 {original != null ? <Money usd={original} rate={rate} strike /> : "—"}
      </p>
      <p className={adultLow ? "font-semibold text-wine-700" : "text-espresso-800"}>
        성인 <Money usd={listing.adultOnly.priceUsd} rate={rate} />
      </p>
    </a>
  );
}

export function CompareTable({ products }: { products: Product[] }) {
  const rate = useUsdKrwRate();

  if (products.length === 0) {
    return (
      <p className="mt-8 text-sm text-espresso-700/70">검색 결과가 없습니다.</p>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-gold-400/25 bg-cream-50/90 shadow-bottle">
      <div className="hidden grid-cols-[92px_minmax(160px,1.4fr)_repeat(3,minmax(110px,1fr))_minmax(140px,0.9fr)] border-b border-gold-400/20 bg-espresso-900 text-[11px] uppercase tracking-[0.16em] text-gold-300 md:grid">
        <div className="px-3 py-3">병</div>
        <div className="px-3 py-3">상품</div>
        {MALLS.map((mall) => (
          <div key={mall.id} className="px-3 py-3">
            {mall.label}
          </div>
        ))}
        <div className="px-3 py-3">최저 성인가</div>
      </div>
      <div className="divide-y divide-gold-400/15">
        {products.map((product) => {
          const adult = lowestFor(product);
          const mallLabel = (id?: MallId) =>
            MALLS.find((m) => m.id === id)?.label ?? "-";
          return (
            <article
              key={product.id}
              className="grid items-center gap-3 px-3 py-3 md:grid-cols-[92px_minmax(160px,1.4fr)_repeat(3,minmax(110px,1fr))_minmax(140px,0.9fr)]"
            >
              <Link href={`/products/${product.id}`} className="justify-self-center">
                <ProductImage product={product} className="h-24 w-[72px]" />
              </Link>
              <div>
                <Link
                  href={`/products/${product.id}`}
                  className="font-display text-lg font-semibold leading-snug text-espresso-900 hover:text-wine-700"
                >
                  {product.brand}
                </Link>
                <p className="text-sm text-espresso-700">{product.name}</p>
                <p className="mt-1 text-xs tracking-wide text-gold-700">
                  {product.volumeMl}ml
                  {product.isSamplePrice ? " · 샘플 가격" : ""}
                </p>
              </div>
              {MALLS.map((mall) => (
                <div key={mall.id} className="text-sm">
                  <p className="mb-1 text-[11px] font-medium text-wine-700 md:hidden">
                    {mall.label}
                  </p>
                  <PriceCell product={product} mallId={mall.id} rate={rate} />
                </div>
              ))}
              <div className="rounded-md bg-wine-50 px-3 py-2 text-sm font-semibold text-wine-700">
                {adult ? (
                  <>
                    {mallLabel(adult.mallId)}{" "}
                    <Money usd={adult.price} rate={rate} />
                  </>
                ) : (
                  "—"
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
