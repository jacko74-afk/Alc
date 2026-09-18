"use client";

import type { Category, Product } from "@/lib/types";
import { productImage } from "@/lib/utils";
import { useState } from "react";

const LIQUID: Record<Category, string> = {
  scotch: "#c47a32",
  japanese: "#d9b36a",
  irish: "#e0c078",
  bourbon: "#b4531a",
  other: "#8f3b2a",
};

function BottleFallback({
  brand,
  category,
}: {
  brand: string;
  category: Category;
}) {
  const fill = LIQUID[category];
  const initial = brand.slice(0, 1);
  return (
    <div className="flex h-full w-full flex-col items-center justify-end bg-gradient-to-b from-espresso-800 to-espresso-950 px-2 pb-2 pt-3">
      <svg viewBox="0 0 48 96" className="h-[78%] w-auto" aria-hidden>
        <rect x="18" y="2" width="12" height="10" rx="1.5" fill="#d4af6a" />
        <path d="M16 12h16l3 14H13z" fill="#3d3229" />
        <rect x="12" y="26" width="24" height="64" rx="8" fill="#2a211b" />
        <rect x="14" y="40" width="20" height="46" rx="6" fill={fill} opacity="0.92" />
        <rect x="14" y="40" width="20" height="10" fill="#f4eadc" opacity="0.18" />
      </svg>
      <span className="mt-1 text-[10px] tracking-[0.18em] text-gold-300">{initial}</span>
    </div>
  );
}

export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const src = productImage(product);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-espresso-900 ${className}`}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${product.brand} ${product.name}`}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <BottleFallback brand={product.brand} category={product.category} />
      )}
    </div>
  );
}
