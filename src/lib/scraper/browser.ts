import type { Page } from "playwright";
import type { MallId } from "@/lib/types";
import { harvestJson, mallFromUrl, type Offer } from "./match";
import { ScrapeStoppedError, throwIfCancelled } from "./control";

export const HOME_URLS: Record<MallId, string> = {
  lotte: "https://kor.lottedfs.com/kr/shopmain/home",
  shilla: "https://www.shilladfs.com/estore/kr/ko",
  shinsegae: "https://www.ssgdfs.com/kr/main/initMain",
};

export const CATEGORY_URLS: Record<MallId, string[]> = {
  lotte: [
    "https://kor.lottedfs.com/kr/display/category/second?dispShopNo1=10055924&dispShopNo2=10055930&treDpth=2",
    "https://kor.lottedfs.com/kr/display/category/first?dispShopNo1=10055924&dprt.KR=D01&treDpth=1",
  ],
  shilla: [
    "https://www.shilladfs.com/estore/kr/ko/c/1211",
    "https://m.shilladfs.com/estore/kr/ko/c/1211",
  ],
  shinsegae: [
    "https://www.ssgdfs.com/kr/dispctg/ctg/liquor/whisky",
    "https://www.ssgdfs.com/kr/dispctg/initDispCtg?dispCtgrId=00020704",
  ],
};

export const BRAND_PAGES: Record<MallId, (brand: string) => string[]> = {
  lotte: (brand) => [
    `https://kor.lottedfs.com/kr/search/searchResult?searchWord=${encodeURIComponent(brand)}`,
    `https://kor.lottedfs.com/kr/search?searchWord=${encodeURIComponent(brand)}`,
  ],
  shilla: (brand) => {
    const slug: Record<string, string[]> = {
      조니워커: ["johnniewalker", "johnnie-walker"],
      발베니: ["balvenie"],
      글렌피딕: ["glenfiddich"],
      글렌리벳: ["glenlivet"],
      글렌모렌지: ["glenmorangie"],
      맥캘란: ["themacallan", "macallan"],
      카발란: ["kavalan"],
      산토리: ["suntory"],
      히비키: ["hibiki"],
      야마자키: ["yamazaki"],
      하쿠슈: ["hakushu"],
      닛카: ["nikka"],
      마르스: ["mars"],
      "버팔로 트레이스": ["buffalotrace"],
      "잭 다니엘": ["jackdaniels"],
      "메이커스 마크": ["makersmark"],
      "우드포드 리저브": ["woodfordreserve"],
      "와일드 터키": ["wildturkey"],
      제임슨: ["jameson"],
      부쉬밀스: ["bushmills"],
      레드브레스트: ["redbreast"],
      "로얄 살루트": ["royalsalute"],
      "시바스 리갈": ["chivasregal"],
      발렌타인: ["ballantines"],
      탈리스커: ["talisker"],
      라가불린: ["lagavulin"],
      보모어: ["bowmore"],
      오번: ["oban"],
      글렌드로낙: ["glendronach"],
      글렌파클라스: ["glenfarclas"],
      글렌알라키: ["glenallachie"],
      "하이랜드 파크": ["highlandpark"],
      아드벡: ["ardbeg"],
      라프로익: ["laphroaig"],
    };
    const slugs = slug[brand] || [];
    return [
      ...slugs.map((s) => `https://www.shilladfs.com/estore/kr/ko/b/${s}`),
      `https://www.shilladfs.com/estore/kr/ko/search?text=${encodeURIComponent(brand)}`,
    ];
  },
  shinsegae: (brand) => [
    `https://www.ssgdfs.com/kr/search/search?searchWord=${encodeURIComponent(brand)}`,
    `https://www.ssgdfs.com/kr/search/searchList?searchWord=${encodeURIComponent(brand)}`,
  ],
};

export function attachJsonSniffer(page: Page, buckets: Record<MallId, Offer[]>) {
  page.on("response", async (res) => {
    const mallId = mallFromUrl(res.url());
    if (!mallId) return;
    const type = res.headers()["content-type"] || "";
    if (!type.includes("json") && !type.includes("javascript")) return;
    if (res.status() !== 200) return;
    try {
      const data = (await res.json()) as unknown;
      buckets[mallId].push(...harvestJson(data, mallId));
    } catch {
      /* not json */
    }
  });
}

export async function safeGoto(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1800);
  } catch {
    /* keep going */
  }
}

const extractDomFn = new Function(
  "id",
  `const origin = location.origin;
  const offers = [];
  const seen = new Set();
  function push(title, url, prices, imageUrl) {
    const clean = String(title).replace(/\\s+/g, " ").trim().slice(0, 180);
    if (clean.length < 4 || !prices.length) return;
    const key = url + "|" + clean + "|" + prices.join(",");
    if (seen.has(key)) return;
    seen.add(key);
    offers.push({
      mallId: id,
      title: clean,
      url: url,
      originalUsd: prices.length > 1 ? Math.max.apply(null, prices) : prices[0],
      saleUsd: prices.length > 1 ? Math.min.apply(null, prices) : prices[0],
      imageUrl: imageUrl || null,
    });
  }
  function pickImg(el) {
    const imgs = el.querySelectorAll("img");
    for (let j = 0; j < imgs.length; j++) {
      const img = imgs[j];
      const src = img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-lazy") || "";
      if (!src || src.indexOf("data:") === 0) continue;
      const low = src.toLowerCase();
      if (low.indexOf("icon") >= 0 || low.indexOf("logo") >= 0 || low.indexOf("sprite") >= 0 || low.indexOf("blank") >= 0) continue;
      try { return new URL(src, origin).toString(); } catch (e) {}
    }
    return "";
  }
  function parsePrices(text) {
    const out = [];
    const re = /(?:US)?[$＄]\\s*[\\d,]+(?:\\.\\d{1,2})?/gi;
    let m;
    while ((m = re.exec(text))) {
      const n = Number(String(m[0]).replace(/[US$＄,\\s]/gi, ""));
      if (n > 1 && n < 20000) out.push(n);
    }
    return out;
  }
  const blocks = Array.from(document.querySelectorAll("li, article, [class*='prd'], [class*='Prd'], [class*='product'], [class*='Product'], [class*='item'], [class*='goods'], [class*='god'], [class*='prod']"));
  for (let i = 0; i < blocks.length; i++) {
    const el = blocks[i];
    const text = (el.innerText || "").replace(/\\s+/g, " ").trim();
    if (text.length < 8 || text.length > 420) continue;
    const prices = parsePrices(text);
    if (prices.length < 1 || prices.length > 4) continue;
    if (text.indexOf("인기 상품") >= 0 || text.indexOf("연령전체") >= 0) continue;
    const imageUrl = pickImg(el);
    const link = el.querySelector("a");
    const parentLink = el.closest("a");
    const href = (link && link.getAttribute("href")) || (parentLink && parentLink.getAttribute("href")) || "";
    if (!href || href.indexOf("javascript") === 0 || href === "#") {
      push(text.replace(/관심상품|장바구니|바로구매|재입고알림|일시품절/g, ""), location.href, prices, imageUrl);
      continue;
    }
    let url = href;
    try { url = new URL(href, origin).toString(); } catch (e) { continue; }
    push(text.replace(/관심상품|장바구니|바로구매|재입고알림|일시품절/g, ""), url, prices, imageUrl);
  }
  const body = (document.body && document.body.innerText ? document.body.innerText : "").replace(/\\r/g, "");
  const lineRe = /([가-힣A-Za-z][가-힣A-Za-z0-9 ·'\\-]{3,80}?\\d{2,4}\\s*m?l)\\s*((?:\\$\\s*[\\d,.]+(?:\\s*\\$\\s*[\\d,.]+)?))/gi;
  let match;
  while ((match = lineRe.exec(body))) {
    push(match[1], location.href, parsePrices(match[2]), "");
  }
  return offers;`,
);

export async function extractDomOffers(page: Page, mallId: MallId): Promise<Offer[]> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.waitForLoadState("domcontentloaded");
      return (await page.evaluate(extractDomFn as (id: MallId) => Offer[], mallId)) as Offer[];
    } catch (error) {
      if (!String(error).includes("Execution context was destroyed")) throw error;
      await page.waitForTimeout(1200);
    }
  }
  return [];
}

export async function searchOnSite(page: Page, mallId: MallId, query: string) {
  const selectors = [
    'input[name="searchWord"]',
    'input[name="query"]',
    'input[name="text"]',
    'input[type="search"]',
    'input[placeholder*="검색"]',
    'input[title*="검색"]',
    "#searchWord",
    "#search",
  ];
  for (const selector of selectors) {
    const box = page.locator(selector).first();
    try {
      if ((await box.count()) === 0) continue;
      if (!(await box.isVisible({ timeout: 800 }))) continue;
      await box.click({ timeout: 2000 });
      await box.fill("");
      await box.fill(query);
      await box.press("Enter");
      await page.waitForTimeout(2500);
      return;
    } catch {
      /* try next */
    }
  }

  for (const url of BRAND_PAGES[mallId](query)) {
    try {
      const res = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForTimeout(2000);
      if (res && (res.ok() || res.status() === 304)) break;
    } catch {
      /* next url */
    }
  }
}

export async function scrollAll(page: Page) {
  for (let i = 0; i < 8; i += 1) {
    try {
      await page.evaluate(() => window.scrollBy(0, 1100));
      await page.waitForTimeout(350);
    } catch {
      return;
    }
  }
}

export async function clickNextPage(page: Page, pageNo: number) {
  const scoped = page.locator(
    '[class*="paging"] a, [class*="Paging"] a, [class*="paginate"] a, [class*="pagination"] a, .page a, nav a',
  );
  const numbered = scoped.filter({ hasText: new RegExp(`^${pageNo}$`) }).first();
  try {
    if ((await numbered.count()) > 0 && (await numbered.isVisible({ timeout: 500 }))) {
      await numbered.click({ timeout: 2000 });
      await page.waitForTimeout(1800);
      return true;
    }
  } catch {
    /* try next button */
  }
  const next = page
    .locator(
      '[class*="paging"] a.btnNext, [class*="paging"] a.next, a[rel="next"], [class*="paging"] a[title="다음"]',
    )
    .first();
  try {
    if ((await next.count()) > 0 && (await next.isVisible({ timeout: 500 }))) {
      await next.click({ timeout: 2000 });
      await page.waitForTimeout(1800);
      return true;
    }
  } catch {
    /* scroll fallback */
  }
  await scrollAll(page);
  return false;
}

export async function waitForAdultOrPrices(page: Page, timeoutMs: number, categoryUrl?: string) {
  const started = Date.now();
  let lastRecat = 0;
  while (Date.now() - started < timeoutMs) {
    await throwIfCancelled();
    try {
      const ready = await page.evaluate(() => {
        const text = document.body && document.body.innerText ? document.body.innerText : "";
        const dollars = (text.match(/\$\s*\d/g) || []).length;
        return {
          url: location.href,
          dollars,
          liquor:
            /dispShopNo1=10055924|c\/1211|liquor|whisky|search/i.test(location.href) ||
            ((text.match(/위스키/g) || []).length >= 5 && (text.match(/\d+\s*ml/gi) || []).length >= 3),
          gate: /성인인증|본인인증/.test(text) && dollars < 3,
        };
      });
      if (ready.liquor && ready.dollars >= 2 && !ready.gate) return true;
      const bounced = /shopmain|initMain|estore\/kr\/ko\/?$/.test(ready.url);
      if (categoryUrl && bounced && Date.now() - lastRecat > 8000) {
        lastRecat = Date.now();
        await safeGoto(page, categoryUrl);
      }
    } catch (error) {
      if (error instanceof ScrapeStoppedError) throw error;
      /* navigating */
    }
    await page.waitForTimeout(1200);
    await throwIfCancelled();
  }
  return false;
}
