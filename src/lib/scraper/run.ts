import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { chromium, type Page } from "playwright";
import { DEFAULT_SEED_COUNT, takeProducts } from "@/data/products";
import { writeCatalog } from "@/lib/catalog-file";
import type { MallId, Product } from "@/lib/types";
import { MALLS } from "@/lib/types";
import {
  CATEGORY_URLS,
  HOME_URLS,
  attachJsonSniffer,
  clickNextPage,
  extractDomOffers,
  safeGoto,
  scrollAll,
  searchOnSite,
  waitForAdultOrPrices,
} from "./browser";
import { ScrapeStoppedError, throwIfCancelled } from "./control";
import { pickBest, type Offer } from "./match";

export type LogFn = (line: string) => void;

const AUTH_WAIT_MS = 180_000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueOffers(items: Offer[]) {
  const map = new Map<string, Offer>();
  for (const item of items) {
    const k = `${item.url}|${item.title}|${item.saleUsd}`;
    const prev = map.get(k);
    if (!prev || (!prev.imageUrl && item.imageUrl)) map.set(k, item);
  }
  return [...map.values()];
}

async function collectForMall(
  page: Page,
  mallId: MallId,
  jsonBucket: Offer[],
  log: LogFn,
  catalog: Product[],
): Promise<Map<string, Offer>> {
  const all: Offer[] = [];

  const take = async (label: string) => {
    await throwIfCancelled();
    await scrollAll(page);
    await page.waitForTimeout(400);
    const before = all.length;
    const dom = await extractDomOffers(page, mallId);
    all.push(...dom);
    all.splice(0, all.length, ...uniqueOffers([...jsonBucket, ...all]));
    log(
      `${mallId}: ${label} → 화면 ${dom.length}개, JSON ${jsonBucket.length}개, 합계 ${all.length}개` +
        (all.length > before && all[all.length - 1]
          ? ` / 예: ${all[all.length - 1].title.slice(0, 40)} $${all[all.length - 1].saleUsd}`
          : ""),
    );
  };

  await safeGoto(page, HOME_URLS[mallId]);
  await throwIfCancelled();
  await safeGoto(page, CATEGORY_URLS[mallId][0]);
  log(`${mallId}: 주류 페이지입니다. 성인인증이 필요하면 열린 창에서 인증하세요. (가격이 보이면 바로 진행)`);
  const ready = await waitForAdultOrPrices(page, AUTH_WAIT_MS, CATEGORY_URLS[mallId][0]);
  await throwIfCancelled();
  if (!/위스키|주류|whisky|liquor|dispShopNo1=10055924|c\/1211|dispctg/i.test(page.url())) {
    log(`${mallId}: 주류 페이지가 아니라 ${page.url()} 입니다. 카테고리를 다시 엽니다.`);
    await safeGoto(page, CATEGORY_URLS[mallId][0]);
  }
  log(
    ready
      ? `${mallId}: 주류 가격이 보여서 수집을 시작합니다. (${page.url()})`
      : `${mallId}: 주류 가격이 거의 안 보입니다. 검색으로 이어서 시도합니다. (${page.url()})`,
  );

  for (const url of CATEGORY_URLS[mallId]) {
    await throwIfCancelled();
    await safeGoto(page, url);
    await take("카테고리");
    for (let pageNo = 2; pageNo <= 12; pageNo += 1) {
      const moved = await clickNextPage(page, pageNo);
      await take(`${pageNo}페이지`);
      if (!moved && pageNo >= 3) break;
    }
  }

  const unmatchedBrands = [
    ...new Set(
      catalog
        .filter((product) => !pickBest(product, all))
        .map((product) => product.brand),
    ),
  ];
  for (const brand of unmatchedBrands) {
    await throwIfCancelled();
    log(`${mallId}: "${brand}" 검색`);
    try {
      await searchOnSite(page, mallId, brand);
      await take(brand);
    } catch (error) {
      if (error instanceof ScrapeStoppedError) throw error;
      log(
        `${mallId}: ${brand} 검색 오류 ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const found = new Map<string, Offer>();
  for (const product of catalog) {
    const best = pickBest(product, all);
    if (best) {
      found.set(product.id, best);
      log(
        `${mallId} / ${product.brand} ${product.name}: $${best.saleUsd} (원래 $${best.originalUsd}) ← ${best.title.slice(0, 48)}`,
      );
    } else {
      log(`${mallId} / ${product.brand} ${product.name}: 일치 상품 없음`);
    }
  }
  return found;
}

function applyAdultOffers(
  products: Product[],
  mallId: MallId,
  offers: Map<string, Offer>,
) {
  return products.map((product) => {
    const offer = offers.get(product.id);
    if (!offer) return product;
    const listing = product.listings[mallId] ?? {
      url: offer.url,
      adultOnly: { priceUsd: null },
      loggedIn: { priceUsd: null },
    };
    const price = {
      priceUsd: offer.saleUsd,
      originalUsd: offer.originalUsd,
    };
    const imageUrl = offer.imageUrl || listing.imageUrl || null;
    const keepExisting =
      !!product.imageUrl &&
      (product.imageUrl.startsWith("/bottles/") ||
        /lottedfs|shilladfs|ssgdfs/.test(product.imageUrl));
    return {
      ...product,
      isSamplePrice: false,
      updatedAt: today(),
      imageUrl: keepExisting ? product.imageUrl : imageUrl || product.imageUrl,
      listings: {
        ...product.listings,
        [mallId]: {
          ...listing,
          url: offer.url || listing.url,
          imageUrl,
          adultOnly: price,
        },
      },
    };
  });
}

async function rememberFirstImage(products: Product[]) {
  return Promise.all(
    products.map(async (product) => {
      if (product.imageUrl) return product;
      for (const mall of MALLS) {
        const remote = product.listings[mall.id]?.imageUrl;
        if (!remote) continue;
        const local = await saveBottleImage(product.id, remote);
        return { ...product, imageUrl: local };
      }
      return product;
    }),
  );
}

async function saveBottleImage(productId: string, imageUrl: string) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return imageUrl;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 800) return imageUrl;
    const dir = path.join(process.cwd(), "public", "bottles");
    await mkdir(dir, { recursive: true });
    const ext = /\.png(\?|$)/i.test(imageUrl) ? "png" : "jpg";
    const file = `${productId}.${ext}`;
    await writeFile(path.join(dir, file), buf);
    return `/bottles/${file}`;
  } catch {
    return imageUrl;
  }
}

export async function runScrape(
  log: LogFn,
  limit = DEFAULT_SEED_COUNT,
): Promise<Product[]> {
  const catalog = takeProducts(limit);
  log(
    `수집용 Chromium을 엽니다. 시드 ${catalog.length}개, 성인인증만 하세요. 회원 로그인은 하지 않습니다.`,
  );
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const jsonBuckets: Record<MallId, Offer[]> = {
    lotte: [],
    shilla: [],
    shinsegae: [],
  };
  attachJsonSniffer(page, jsonBuckets);

  let current = catalog.map((item) => structuredClone(item));
  let stopped = false;

  try {
    await page.context().clearCookies();
    for (const mall of MALLS) {
      await throwIfCancelled();
      log(`--- ${mall.label} 성인인증가 ---`);
      jsonBuckets[mall.id].length = 0;
      try {
        const offers = await collectForMall(
          page,
          mall.id,
          jsonBuckets[mall.id],
          log,
          catalog,
        );
        current = applyAdultOffers(current, mall.id, offers);
      } catch (error) {
        if (error instanceof ScrapeStoppedError) throw error;
        log(
          `${mall.label} 성인인증가 실패: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    if (error instanceof ScrapeStoppedError) {
      stopped = true;
      log("수집을 중단했습니다. 지금까지 모은 성인가를 저장합니다.");
    } else {
      throw error;
    }
  } finally {
    await browser.close();
  }

  current = await rememberFirstImage(current);

  await writeCatalog(current);
  const hit = current.filter((p) => !p.isSamplePrice).length;
  log(
    stopped
      ? `중단 저장. 실제 가격이 반영된 상품 ${hit}개를 live-prices.json에 저장했습니다.`
      : `수집 종료. 실제 가격이 반영된 상품 ${hit}개를 live-prices.json에 저장했습니다. 셀러는 이 파일을 불러 비교합니다.`,
  );
  return current;
}
