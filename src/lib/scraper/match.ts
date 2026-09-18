import type { MallId } from "@/lib/types";

export type Offer = {
  mallId: MallId;
  title: string;
  url: string;
  originalUsd: number | null;
  saleUsd: number | null;
  imageUrl?: string | null;
};

const BRAND_ALIASES: Record<string, string[]> = {
  조니워커: ["johnniewalker", "johnnie walker", "조니 워커"],
  발베니: ["balvenie"],
  글렌피딕: ["glenfiddich"],
  글렌리벳: ["glenlivet"],
  글렌모렌지: ["glenmorangie"],
  맥캘란: ["macallan", "themacallan"],
  카발란: ["kavalan"],
  산토리: ["suntory"],
  히비키: ["hibiki"],
  야마자키: ["yamazaki"],
  하쿠슈: ["hakushu"],
  닛카: ["nikka"],
  마르스: ["mars", "iwai", "이와이"],
  "버팔로 트레이스": ["buffalotrace", "eaglerare", "이글레어"],
  "잭 다니엘": ["jackdaniel", "jack daniels", "잭다니엘"],
  "메이커스 마크": ["makersmark", "maker's mark"],
  "우드포드 리저브": ["woodfordreserve", "우드포드리저브"],
  "와일드 터키": ["wildturkey", "와일드터키"],
  제임슨: ["jameson"],
  부쉬밀스: ["bushmills", "bushmill", "부쉬밀"],
  레드브레스트: ["redbreast"],
  "로얄 살루트": ["royalsalute", "로얄살루트"],
  "시바스 리갈": ["chivasregal", "시바스리갈"],
  발렌타인: ["ballantine", "ballantines"],
  탈리스커: ["talisker"],
  라가불린: ["lagavulin"],
  보모어: ["bowmore"],
  오번: ["oban"],
  글렌드로낙: ["glendronach"],
  글렌파클라스: ["glenfarclas"],
  글렌알라키: ["glenallachie"],
  "하이랜드 파크": ["highlandpark", "하이랜드파크"],
  아드벡: ["ardbeg"],
  라프로익: ["laphroaig"],
};

const NAME_ALIASES: Record<string, string[]> = {
  블루: ["blue"],
  블랙: ["black"],
  골드: ["gold"],
  라벨: ["label"],
  더블우드: ["doublewood", "double wood"],
  캐리비안: ["caribbean", "caribbean cask"],
  더블캐스크: ["doublecask", "double cask"],
  오리지널: ["original"],
  라산타: ["lasanta"],
  클래식: ["classic"],
  "비노 바리끄": ["vino", "barrique", "solist"],
  솔리스트: ["solist"],
  치타: ["chita"],
  아오: ["ao"],
  하모니: ["harmony"],
  세션: ["session"],
  "프롬 더 배럴": ["from the barrel", "fromthebarrel"],
  요이치: ["yoichi"],
  미야기쿄: ["miyagikyo"],
  트레디션: ["tradition", "iwai"],
  이글레어: ["eagle rare", "eaglerare"],
  "올드 no7": ["old no.7", "old no7", "old7", "블랙"],
  켄터키: ["makers"],
  "디스틸러 셀렉트": ["distiller", "woodford"],
  레드브레스트: ["redbreast"],
};

export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[()[\]{}]/g, " ")
    .replace(/ml/g, "")
    .replace(/[^0-9a-z가-힣]/gi, "")
    .trim();
}

export function volumeOf(text: string): number | null {
  const liter = text.match(/(\d+(?:\.\d+)?)\s*l\b/i);
  if (liter && !/ml/i.test(liter[0])) {
    const n = Number(liter[1]) * 1000;
    if (n >= 200 && n <= 2000) return n;
  }
  const ml = text.match(/(\d{2,4})\s*ml/i);
  if (ml) return Number(ml[1]);
  return null;
}

export function yearOf(text: string): string | null {
  const yo = text.match(/(\d{1,2})\s*(?:년|year|yo)\b/i);
  if (yo) return yo[1];
  return null;
}

function brandHit(brand: string, hay: string, raw: string) {
  const n = normalize(brand);
  if (n && hay.includes(n)) return true;
  return (BRAND_ALIASES[brand] || []).some((alias) =>
    hay.includes(normalize(alias)) || raw.toLowerCase().includes(alias.toLowerCase()),
  );
}

function tokenHit(token: string, hay: string, raw: string) {
  const n = normalize(token);
  if (n.length >= 2 && hay.includes(n)) return true;
  const aliases = NAME_ALIASES[token] || NAME_ALIASES[token.replace(/\s/g, "")] || [];
  return aliases.some(
    (alias) => hay.includes(normalize(alias)) || raw.toLowerCase().includes(alias.toLowerCase()),
  );
}

export function scoreOffer(
  product: { brand: string; name: string; volumeMl: number },
  offer: Offer,
) {
  const raw = `${offer.title} ${offer.url}`;
  const hay = normalize(raw);
  if (!brandHit(product.brand, hay, raw)) return 0;

  const offerMl = volumeOf(offer.title);
  if (offerMl && offerMl !== product.volumeMl) return 0;

  const productYear = yearOf(product.name);
  const offerYear = yearOf(offer.title);
  if (productYear && offerYear && productYear !== offerYear) return 0;

  let score = 45;
  if (productYear && (hay.includes(`${productYear}년`) || hay.includes(productYear))) score += 25;
  if (offerMl === product.volumeMl || hay.includes(String(product.volumeMl))) score += 25;

  const tokens = product.name.split(/\s+/).filter((t) => t.length >= 2 && !/^\d+년$/.test(t));
  let tokenHits = 0;
  for (const token of tokens) {
    if (tokenHit(token, hay, raw)) {
      tokenHits += 1;
      score += 12;
    }
  }
  if (tokens.length > 0 && tokenHits === 0 && offer.title.length > 28) {
    return 0;
  }
  return score;
}

export function pickBest(
  product: { brand: string; name: string; volumeMl: number },
  offers: Offer[],
) {
  let best: { offer: Offer; score: number } | null = null;
  for (const offer of offers) {
    if (offer.saleUsd == null) continue;
    const score = scoreOffer(product, offer);
    if (score < 45) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && offer.imageUrl && !best.offer.imageUrl)
    ) {
      best = { offer, score };
    }
  }
  return best?.offer ?? null;
}

function toUsd(value: unknown): number | null {
  if (typeof value === "number" && value > 0 && value < 20000) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[US$＄,\s]/gi, ""));
    if (Number.isFinite(n) && n > 0 && n < 20000) return n;
  }
  return null;
}

function absoluteAsset(mallId: MallId, raw: string) {
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http")) return raw;
  if (raw.startsWith("/")) {
    const host =
      mallId === "lotte"
        ? "https://kor.lottedfs.com"
        : mallId === "shilla"
          ? "https://www.shilladfs.com"
          : "https://www.ssgdfs.com";
    return host + raw;
  }
  return raw;
}

function imageFromRecord(mallId: MallId, rec: Record<string, unknown>) {
  const raw = [
    rec.prdImg,
    rec.imgUrl,
    rec.godImg,
    rec.thnlPath,
    rec.imageUrl,
    rec.imgPath,
    rec.image,
    rec.thumbImg,
    rec.thumnailUrl,
    rec.thumbnail,
    rec.img,
    rec.mainImg,
    rec.goosImg,
    rec.productImg,
  ].find((item) => typeof item === "string" && String(item).length > 8);
  if (typeof raw !== "string") return null;
  if (raw.startsWith("data:")) return null;
  return absoluteAsset(mallId, raw);
}

function productUrl(mallId: MallId, rec: Record<string, unknown>) {
  const raw = [
    rec.url,
    rec.prdUrl,
    rec.goosUrl,
    rec.linkUrl,
    rec.detailUrl,
    rec.godUrl,
    rec.itemUrl,
  ].find((item) => typeof item === "string" && String(item).length > 3);
  if (typeof raw === "string") {
    if (raw.startsWith("http")) return raw;
    if (raw.startsWith("/")) {
      const host =
        mallId === "lotte"
          ? "https://kor.lottedfs.com"
          : mallId === "shilla"
            ? "https://www.shilladfs.com"
            : "https://www.ssgdfs.com";
      return host + raw;
    }
  }
  const id = rec.prdId ?? rec.goosId ?? rec.godId ?? rec.productId ?? rec.id ?? rec.sku;
  if (id == null) return "";
  if (mallId === "lotte") return `https://kor.lottedfs.com/kr/product/${id}`;
  if (mallId === "shilla") return `https://www.shilladfs.com/estore/kr/ko/p/${id}`;
  return `https://www.ssgdfs.com/kr/product/productDetail?sku=${id}`;
}

export function harvestJson(data: unknown, mallId: MallId): Offer[] {
  const out: Offer[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 10 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    const rec = node as Record<string, unknown>;
    const title = [
      rec.brndNm,
      rec.brandNm,
      rec.brandName,
      rec.brand,
      rec.prdNm,
      rec.goosNm,
      rec.godNm,
      rec.productName,
      rec.goodsNm,
      rec.prdName,
      rec.itemNm,
      rec.itemName,
      rec.name,
    ]
      .filter((item) => typeof item === "string")
      .join(" ");
    const nums = [
      rec.salePrc,
      rec.salePrice,
      rec.dcPrc,
      rec.discountPrice,
      rec.lastPrc,
      rec.lastSalePrc,
      rec.goosPrc,
      rec.nrmlPrc,
      rec.normalPrice,
      rec.csmrPrc,
      rec.prc,
      rec.price,
      rec.usdPrc,
      rec.usSalePrc,
      rec.maxDcPrc,
      rec.onlinePrc,
      rec.memberPrc,
      rec.finalPrc,
      rec.benefitPrc,
      rec.splprc,
      rec.sellprc,
      rec.splPrc,
    ]
      .map(toUsd)
      .filter((n): n is number => n != null);
    if (title.replace(/\s/g, "").length > 2 && nums.length > 0) {
      out.push({
        mallId,
        title: title.slice(0, 200),
        url: productUrl(mallId, rec),
        originalUsd: Math.max(...nums),
        saleUsd: Math.min(...nums),
        imageUrl: imageFromRecord(mallId, rec),
      });
    }
    for (const value of Object.values(rec)) visit(value, depth + 1);
  };
  visit(data, 0);
  return out;
}

export function mallFromUrl(url: string): MallId | null {
  if (url.includes("lottedfs.com")) return "lotte";
  if (url.includes("shilladfs.com")) return "shilla";
  if (url.includes("ssgdfs.com")) return "shinsegae";
  return null;
}
