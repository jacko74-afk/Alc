"use client";

import { allProducts, DEFAULT_SEED_COUNT, takeProducts } from "@/data/products";
import type { Product } from "@/lib/types";
import { SEED_COUNT_KEY } from "@/lib/utils";

export type LiveCatalog = {
  products: Product[];
  source: "live" | "empty";
  file: string;
  savedAt: string | null;
};

export function getSeedCount() {
  if (typeof window === "undefined") return DEFAULT_SEED_COUNT;
  const n = Number(localStorage.getItem(SEED_COUNT_KEY));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SEED_COUNT;
  return Math.min(Math.round(n), allProducts.length);
}

export function setSeedCount(count: number) {
  const n = Math.min(Math.max(1, Math.round(count)), allProducts.length);
  localStorage.setItem(SEED_COUNT_KEY, String(n));
  return n;
}

export async function loadLiveCatalog(): Promise<LiveCatalog> {
  const res = await fetch("/api/products", { cache: "no-store" });
  const data = (await res.json()) as Partial<LiveCatalog> & { products?: Product[] };
  const products = Array.isArray(data.products) ? data.products : [];
  return {
    products,
    source: products.length > 0 ? "live" : "empty",
    file: data.file || "live-prices.json",
    savedAt: data.savedAt ?? null,
  };
}

export async function saveLiveCatalog(password: string, products: Product[]) {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, products }),
  });
  const data = (await res.json()) as { error?: string; savedAt?: string; file?: string };
  if (!res.ok) {
    throw new Error(data.error || "JSON 파일 저장에 실패했습니다.");
  }
  return data;
}

export function seedCatalog(count = getSeedCount(), live: Product[] = []) {
  return takeProducts(count, live);
}
