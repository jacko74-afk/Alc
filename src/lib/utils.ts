import type { MallId, MallListing, Product } from "./types";
import { MALLS } from "./types";

export function formatUsd(value: number | null | undefined) {
  if (value == null) return "확인 불가";
  return `$${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)}`;
}

export const DEFAULT_USD_KRW = 1370;

export function usdToKrw(usd: number, rate = DEFAULT_USD_KRW) {
  return Math.round(usd * rate);
}

export function formatKrw(value: number | null | undefined, rate = DEFAULT_USD_KRW) {
  if (value == null) return "확인 불가";
  return `${usdToKrw(value, rate).toLocaleString("ko-KR")}원`;
}

export function originalUsd(listing: MallListing) {
  return listing.adultOnly.originalUsd ?? listing.loggedIn.originalUsd ?? null;
}

export function lowestFor(product: Product): { mallId: MallId; price: number } | null {
  let best: { mallId: MallId; price: number } | null = null;
  for (const mall of MALLS) {
    const price = product.listings[mall.id]?.adultOnly.priceUsd;
    if (price == null) continue;
    if (!best || price < best.price) best = { mallId: mall.id, price };
  }
  return best;
}

export function productImage(product: Product) {
  if (product.imageUrl) return product.imageUrl;
  for (const mall of MALLS) {
    const img = product.listings[mall.id]?.imageUrl;
    if (img) return img;
  }
  return null;
}

export function productLowestPrice(product: Product) {
  return lowestFor(product)?.price ?? Number.POSITIVE_INFINITY;
}

export function isAdult(birthYmd: string, now = new Date()) {
  if (!/^\d{8}$/.test(birthYmd)) return false;
  const year = Number(birthYmd.slice(0, 4));
  const month = Number(birthYmd.slice(4, 6));
  const day = Number(birthYmd.slice(6, 8));
  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return false;
  }
  let age = now.getFullYear() - year;
  const hadBirthday =
    now.getMonth() > month - 1 ||
    (now.getMonth() === month - 1 && now.getDate() >= day);
  if (!hadBirthday) age -= 1;
  return age >= 19;
}

export const AGE_STORAGE_KEY = "dutyfree_age_verified";
export const ADMIN_STORAGE_KEY = "dutyfree_admin_ok";
export const SEED_COUNT_KEY = "dutyfree_seed_count";
export const AGE_DAYS = 30;
