export type Category = "scotch" | "japanese" | "irish" | "bourbon" | "other";
export type MallId = "lotte" | "shilla" | "shinsegae";

export type PriceBasis = {
  priceUsd: number | null;
  originalUsd?: number | null;
};

export type MallListing = {
  url: string;
  imageUrl?: string | null;
  adultOnly: PriceBasis;
  loggedIn: PriceBasis;
};

export type Product = {
  id: string;
  brand: string;
  name: string;
  volumeMl: number;
  category: Category;
  listings: Partial<Record<MallId, MallListing>>;
  updatedAt: string;
  isSamplePrice: boolean;
  imageUrl?: string | null;
};

export const MALLS: { id: MallId; label: string }[] = [
  { id: "lotte", label: "롯데" },
  { id: "shilla", label: "신라" },
  { id: "shinsegae", label: "신세계" },
];

export const CATEGORIES: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "scotch", label: "스카치" },
  { id: "japanese", label: "일본" },
  { id: "irish", label: "아이리시" },
  { id: "bourbon", label: "버번" },
  { id: "other", label: "기타" },
];

export const MALL_FALLBACK_URLS: Record<MallId, string> = {
  lotte:
    "https://m.kor.lottedfs.com/kr/display/category/second?dispShopNo1=10055924&dispShopNo2=10055930&treDpth=2",
  shilla: "https://m.shilladfs.com/estore/kr/ko/c/1211",
  shinsegae: "https://www.ssgdfs.com/kr/dispctg/ctg/liquor/whisky",
};
