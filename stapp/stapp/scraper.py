from __future__ import annotations

import json
import re
from copy import deepcopy
from datetime import date, datetime, timezone
from urllib.parse import quote
from urllib.request import urlopen

from stapp.catalog import write_catalog
from stapp.config import BOTTLES_DIR, CONTROL_FILE, DATA_DIR, MALLS, PROGRESS_FILE
from stapp.match import harvest_json, mall_from_url, pick_best
from stapp.products import take_products

AUTH_WAIT_MS = 180_000

HOME_URLS = {
    "lotte": "https://kor.lottedfs.com/kr/shopmain/home",
    "shilla": "https://www.shilladfs.com/estore/kr/ko",
    "shinsegae": "https://www.ssgdfs.com/kr/main/initMain",
}

CATEGORY_URLS = {
    "lotte": [
        "https://kor.lottedfs.com/kr/display/category/second?dispShopNo1=10055924&dispShopNo2=10055930&treDpth=2",
        "https://kor.lottedfs.com/kr/display/category/first?dispShopNo1=10055924&dprt.KR=D01&treDpth=1",
    ],
    "shilla": [
        "https://www.shilladfs.com/estore/kr/ko/c/1211",
        "https://m.shilladfs.com/estore/kr/ko/c/1211",
    ],
    "shinsegae": [
        "https://www.ssgdfs.com/kr/dispctg/ctg/liquor/whisky",
        "https://www.ssgdfs.com/kr/dispctg/initDispCtg?dispCtgrId=00020704",
    ],
}

SHILLA_SLUGS = {
    "조니워커": ["johnniewalker", "johnnie-walker"],
    "발베니": ["balvenie"],
    "글렌피딕": ["glenfiddich"],
    "글렌리벳": ["glenlivet"],
    "글렌모렌지": ["glenmorangie"],
    "맥캘란": ["themacallan", "macallan"],
    "카발란": ["kavalan"],
    "산토리": ["suntory"],
    "히비키": ["hibiki"],
    "야마자키": ["yamazaki"],
    "하쿠슈": ["hakushu"],
    "닛카": ["nikka"],
    "마르스": ["mars"],
    "버팔로 트레이스": ["buffalotrace"],
    "잭 다니엘": ["jackdaniels"],
    "메이커스 마크": ["makersmark"],
    "우드포드 리저브": ["woodfordreserve"],
    "와일드 터키": ["wildturkey"],
    "제임슨": ["jameson"],
    "부쉬밀스": ["bushmills"],
    "레드브레스트": ["redbreast"],
    "로얄 살루트": ["royalsalute"],
    "시바스 리갈": ["chivasregal"],
    "발렌타인": ["ballantines"],
    "탈리스커": ["talisker"],
    "라가불린": ["lagavulin"],
    "보모어": ["bowmore"],
    "오번": ["oban"],
    "글렌드로낙": ["glendronach"],
    "글렌파클라스": ["glenfarclas"],
    "글렌알라키": ["glenallachie"],
    "하이랜드 파크": ["highlandpark"],
    "아드벡": ["ardbeg"],
    "라프로익": ["laphroaig"],
}


class ScrapeStoppedError(Exception):
    pass


def set_scrape_cancel(cancel: bool) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CONTROL_FILE.write_text(json.dumps({"cancel": cancel}), encoding="utf-8")


def is_scrape_cancelled() -> bool:
    try:
        return bool(json.loads(CONTROL_FILE.read_text(encoding="utf-8")).get("cancel"))
    except (OSError, json.JSONDecodeError):
        return False


def throw_if_cancelled() -> None:
    if is_scrape_cancelled():
        raise ScrapeStoppedError("수집이 중단되었습니다.")


def write_progress(logs: list[str], done: bool, error: str | None = None) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(
        json.dumps(
            {
                "logs": logs,
                "done": done,
                "error": error,
                "at": datetime.now(timezone.utc).isoformat(),
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def read_progress() -> dict:
    try:
        return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"logs": [], "done": True, "error": None}


def _brand_pages(mall_id: str, brand: str) -> list[str]:
    q = quote(brand)
    if mall_id == "lotte":
        return [
            f"https://kor.lottedfs.com/kr/search/searchResult?searchWord={q}",
            f"https://kor.lottedfs.com/kr/search?searchWord={q}",
        ]
    if mall_id == "shilla":
        slugs = SHILLA_SLUGS.get(brand, [])
        return [
            *[f"https://www.shilladfs.com/estore/kr/ko/b/{s}" for s in slugs],
            f"https://www.shilladfs.com/estore/kr/ko/search?text={q}",
        ]
    return [
        f"https://www.ssgdfs.com/kr/search/search?searchWord={q}",
        f"https://www.ssgdfs.com/kr/search/searchList?searchWord={q}",
    ]


EXTRACT_DOM_JS = """
(id) => {
  const origin = location.origin;
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
  return offers;
}
"""


def unique_offers(items: list[dict]) -> list[dict]:
    mapped = {}
    for item in items:
        key = f"{item.get('url')}|{item.get('title')}|{item.get('saleUsd')}"
        prev = mapped.get(key)
        if not prev or (not prev.get("imageUrl") and item.get("imageUrl")):
            mapped[key] = item
    return list(mapped.values())


def safe_goto(page, url: str) -> None:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=45_000)
        page.wait_for_timeout(1800)
    except Exception:
        pass


def extract_dom_offers(page, mall_id: str) -> list[dict]:
    for _ in range(4):
        try:
            page.wait_for_load_state("domcontentloaded")
            return page.evaluate(EXTRACT_DOM_JS, mall_id) or []
        except Exception as error:
            if "Execution context was destroyed" not in str(error):
                raise
            page.wait_for_timeout(1200)
    return []


def search_on_site(page, mall_id: str, query: str) -> None:
    selectors = [
        'input[name="searchWord"]',
        'input[name="query"]',
        'input[name="text"]',
        'input[type="search"]',
        'input[placeholder*="검색"]',
        'input[title*="검색"]',
        "#searchWord",
        "#search",
    ]
    for selector in selectors:
        box = page.locator(selector).first
        try:
            if box.count() == 0:
                continue
            if not box.is_visible(timeout=800):
                continue
            box.click(timeout=2000)
            box.fill("")
            box.fill(query)
            box.press("Enter")
            page.wait_for_timeout(2500)
            return
        except Exception:
            continue
    for url in _brand_pages(mall_id, query):
        try:
            res = page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            page.wait_for_timeout(2000)
            if res and (res.ok or res.status == 304):
                break
        except Exception:
            continue


def scroll_all(page) -> None:
    for _ in range(8):
        try:
            page.evaluate("() => window.scrollBy(0, 1100)")
            page.wait_for_timeout(350)
        except Exception:
            return


def click_next_page(page, page_no: int) -> bool:
    scoped = page.locator(
        '[class*="paging"] a, [class*="Paging"] a, [class*="paginate"] a, [class*="pagination"] a, .page a, nav a'
    )
    numbered = scoped.filter(has_text=re.compile(rf"^{page_no}$")).first
    try:
        if numbered.count() > 0 and numbered.is_visible(timeout=500):
            numbered.click(timeout=2000)
            page.wait_for_timeout(1800)
            return True
    except Exception:
        pass
    nxt = page.locator(
        '[class*="paging"] a.btnNext, [class*="paging"] a.next, a[rel="next"], [class*="paging"] a[title="다음"]'
    ).first
    try:
        if nxt.count() > 0 and nxt.is_visible(timeout=500):
            nxt.click(timeout=2000)
            page.wait_for_timeout(1800)
            return True
    except Exception:
        pass
    scroll_all(page)
    return False


def wait_for_adult_or_prices(page, timeout_ms: int, category_url: str | None = None) -> bool:
    started = datetime.now().timestamp() * 1000
    last_recat = 0
    while datetime.now().timestamp() * 1000 - started < timeout_ms:
        throw_if_cancelled()
        try:
            ready = page.evaluate(
                """() => {
                  const text = document.body && document.body.innerText ? document.body.innerText : "";
                  const dollars = (text.match(/\\$\\s*\\d/g) || []).length;
                  return {
                    url: location.href,
                    dollars,
                    liquor:
                      /dispShopNo1=10055924|c\\/1211|liquor|whisky|search/i.test(location.href) ||
                      ((text.match(/위스키/g) || []).length >= 5 && (text.match(/\\d+\\s*ml/gi) || []).length >= 3),
                    gate: /성인인증|본인인증/.test(text) && dollars < 3,
                  };
                }"""
            )
            if ready["liquor"] and ready["dollars"] >= 2 and not ready["gate"]:
                return True
            bounced = bool(re.search(r"shopmain|initMain|estore/kr/ko/?$", ready["url"]))
            now = datetime.now().timestamp() * 1000
            if category_url and bounced and now - last_recat > 8000:
                last_recat = now
                safe_goto(page, category_url)
        except ScrapeStoppedError:
            raise
        except Exception:
            pass
        page.wait_for_timeout(1200)
        throw_if_cancelled()
    return False


def collect_for_mall(page, mall_id: str, json_bucket: list[dict], log, catalog: list[dict]) -> dict[str, dict]:
    all_offers: list[dict] = []

    def take(label: str):
        throw_if_cancelled()
        scroll_all(page)
        page.wait_for_timeout(400)
        before = len(all_offers)
        dom = extract_dom_offers(page, mall_id)
        all_offers[:] = unique_offers([*json_bucket, *all_offers, *dom])
        extra = ""
        if len(all_offers) > before and all_offers:
            last = all_offers[-1]
            extra = f" / 예: {str(last.get('title', ''))[:40]} ${last.get('saleUsd')}"
        log(
            f"{mall_id}: {label} → 화면 {len(dom)}개, JSON {len(json_bucket)}개, 합계 {len(all_offers)}개{extra}"
        )

    safe_goto(page, HOME_URLS[mall_id])
    throw_if_cancelled()
    safe_goto(page, CATEGORY_URLS[mall_id][0])
    log(f"{mall_id}: 주류 페이지입니다. 성인인증이 필요하면 열린 창에서 인증하세요. (가격이 보이면 바로 진행)")
    ready = wait_for_adult_or_prices(page, AUTH_WAIT_MS, CATEGORY_URLS[mall_id][0])
    throw_if_cancelled()
    if not re.search(
        r"위스키|주류|whisky|liquor|dispShopNo1=10055924|c/1211|dispctg",
        page.url,
        re.I,
    ):
        log(f"{mall_id}: 주류 페이지가 아니라 {page.url} 입니다. 카테고리를 다시 엽니다.")
        safe_goto(page, CATEGORY_URLS[mall_id][0])
    log(
        f"{mall_id}: 주류 가격이 보여서 수집을 시작합니다. ({page.url})"
        if ready
        else f"{mall_id}: 주류 가격이 거의 안 보입니다. 검색으로 이어서 시도합니다. ({page.url})"
    )

    for url in CATEGORY_URLS[mall_id]:
        throw_if_cancelled()
        safe_goto(page, url)
        take("카테고리")
        for page_no in range(2, 13):
            moved = click_next_page(page, page_no)
            take(f"{page_no}페이지")
            if not moved and page_no >= 3:
                break

    unmatched = []
    seen_brands = set()
    for product in catalog:
        if pick_best(product, all_offers):
            continue
        if product["brand"] not in seen_brands:
            seen_brands.add(product["brand"])
            unmatched.append(product["brand"])

    for brand in unmatched:
        throw_if_cancelled()
        log(f'{mall_id}: "{brand}" 검색')
        try:
            search_on_site(page, mall_id, brand)
            take(brand)
        except ScrapeStoppedError:
            raise
        except Exception as error:
            log(f"{mall_id}: {brand} 검색 오류 {error}")

    found = {}
    for product in catalog:
        best = pick_best(product, all_offers)
        if best:
            found[product["id"]] = best
            log(
                f"{mall_id} / {product['brand']} {product['name']}: ${best.get('saleUsd')} (원래 ${best.get('originalUsd')}) ← {str(best.get('title', ''))[:48]}"
            )
        else:
            log(f"{mall_id} / {product['brand']} {product['name']}: 일치 상품 없음")
    return found


def apply_adult_offers(products: list[dict], mall_id: str, offers: dict[str, dict]) -> list[dict]:
    today = date.today().isoformat()
    next_list = []
    for product in products:
        offer = offers.get(product["id"])
        if not offer:
            next_list.append(product)
            continue
        listing = deepcopy(product.get("listings", {}).get(mall_id) or {
            "url": offer.get("url"),
            "adultOnly": {"priceUsd": None},
            "loggedIn": {"priceUsd": None},
        })
        image_url = offer.get("imageUrl") or listing.get("imageUrl")
        keep = bool(product.get("imageUrl")) and (
            str(product["imageUrl"]).startswith("/bottles/")
            or bool(re.search(r"lottedfs|shilladfs|ssgdfs", str(product["imageUrl"])))
        )
        updated = deepcopy(product)
        updated["isSamplePrice"] = False
        updated["updatedAt"] = today
        updated["imageUrl"] = product["imageUrl"] if keep else (image_url or product.get("imageUrl"))
        listing["url"] = offer.get("url") or listing.get("url")
        listing["imageUrl"] = image_url
        listing["adultOnly"] = {
            "priceUsd": offer.get("saleUsd"),
            "originalUsd": offer.get("originalUsd"),
        }
        updated.setdefault("listings", {})[mall_id] = listing
        next_list.append(updated)
    return next_list


def save_bottle_image(product_id: str, image_url: str) -> str:
    try:
        with urlopen(image_url, timeout=20) as res:
            buf = res.read()
        if len(buf) < 800:
            return image_url
        BOTTLES_DIR.mkdir(parents=True, exist_ok=True)
        ext = "png" if re.search(r"\.png(\?|$)", image_url, re.I) else "jpg"
        path = BOTTLES_DIR / f"{product_id}.{ext}"
        path.write_bytes(buf)
        return f"/bottles/{product_id}.{ext}"
    except Exception:
        return image_url


def remember_first_image(products: list[dict]) -> list[dict]:
    out = []
    for product in products:
        if product.get("imageUrl"):
            out.append(product)
            continue
        updated = deepcopy(product)
        for mall in MALLS:
            remote = (product.get("listings") or {}).get(mall["id"], {}).get("imageUrl")
            if not remote:
                continue
            updated["imageUrl"] = save_bottle_image(product["id"], remote)
            break
        out.append(updated)
    return out


def run_scrape(limit: int, log) -> list[dict]:
    from playwright.sync_api import sync_playwright

    catalog = take_products(limit)
    log(f"수집용 Chromium을 엽니다. 시드 {len(catalog)}개, 성인인증만 하세요. 회원 로그인은 하지 않습니다.")
    buckets = {"lotte": [], "shilla": [], "shinsegae": []}
    current = deepcopy(catalog)
    stopped = False

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = browser.new_page(
            viewport={"width": 1400, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        )

        def on_response(response):
            mall_id = mall_from_url(response.url)
            if not mall_id:
                return
            ctype = (response.headers.get("content-type") or "")
            if "json" not in ctype and "javascript" not in ctype:
                return
            if response.status != 200:
                return
            try:
                buckets[mall_id].extend(harvest_json(response.json(), mall_id))
            except Exception:
                pass

        page.on("response", on_response)
        try:
            page.context.clear_cookies()
            for mall in MALLS:
                throw_if_cancelled()
                log(f"--- {mall['label']} 성인인증가 ---")
                buckets[mall["id"]].clear()
                try:
                    offers = collect_for_mall(page, mall["id"], buckets[mall["id"]], log, catalog)
                    current = apply_adult_offers(current, mall["id"], offers)
                except ScrapeStoppedError:
                    raise
                except Exception as error:
                    log(f"{mall['label']} 성인인증가 실패: {error}")
        except ScrapeStoppedError:
            stopped = True
            log("수집을 중단했습니다. 지금까지 모은 성인가를 저장합니다.")
        finally:
            browser.close()

    current = remember_first_image(current)
    write_catalog(current)
    hit = sum(1 for p in current if not p.get("isSamplePrice"))
    log(
        f"중단 저장. 실제 가격이 반영된 상품 {hit}개를 live-prices.json에 저장했습니다."
        if stopped
        else f"수집 종료. 실제 가격이 반영된 상품 {hit}개를 live-prices.json에 저장했습니다. 셀러는 이 파일을 불러 비교합니다."
    )
    return current


def scrape_in_background(limit: int) -> None:
    logs: list[str] = []

    def log(line: str):
        logs.append(line)
        write_progress(logs, False)

    try:
        set_scrape_cancel(False)
        write_progress([f"수집을 시작합니다. 시드 {limit}개, 성인인증가만 가져옵니다."], False)
        logs.append(f"수집을 시작합니다. 시드 {limit}개, 성인인증가만 가져옵니다.")
        run_scrape(limit, log)
        write_progress(logs, True)
    except Exception as error:
        logs.append(f"실패: {error}")
        write_progress(logs, True, str(error))
