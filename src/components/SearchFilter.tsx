"use client";

import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

type Props = {
  query: string;
  category: Category | "all";
  onQuery: (value: string) => void;
  onCategory: (value: Category | "all") => void;
};

export function SearchFilter({ query, category, onQuery, onCategory }: Props) {
  return (
    <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="브랜드·상품명 검색"
        className="w-full rounded-md border border-espresso-700/15 bg-cream-50 px-3 py-2.5 text-sm outline-none focus:border-gold-500 lg:max-w-xs"
      />
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onCategory(item.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs tracking-wide ${
              category === item.id
                ? "bg-wine-600 text-cream-50 shadow-bottle"
                : "bg-cream-50 text-espresso-700 ring-1 ring-espresso-700/15 hover:ring-gold-500"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
