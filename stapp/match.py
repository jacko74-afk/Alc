from __future__ import annotations

import re

BRAND_ALIASES = {
    "조니워커": ["johnniewalker", "johnnie walker", "조니 워커"],
    "발베니": ["balvenie"],
    "글렌피딕": ["glenfiddich"],
    "글렌리벳": ["glenlivet"],
    "글렌모렌지": ["glenmorangie"],
    "맥캘란": ["macallan", "themacallan"],
    "카발란": ["kavalan"],
    "산토리": ["suntory"],
    "히비키": ["hibiki"],
    "야마자키": ["yamazaki"],
    "하쿠슈": ["hakushu"],
    "닛카": ["nikka"],
    "마르스": ["mars", "iwai", "이와이"],
    "버팔로 트레이스": ["buffalotrace", "eaglerare", "이글레어"],
    "잭 다니엘": ["jackdaniel", "jack daniels", "잭다니엘"],
    "메이커스 마크": ["makersmark", "maker's mark"],
    "우드포드 리저브": ["woodfordreserve", "우드포드리저브"],
    "와일드 터키": ["wildturkey", "와일드터키"],
    "제임슨": ["jameson"],
    "부쉬밀스": ["bushmills", "bushmill", "부쉬밀"],
    "레드브레스트": ["redbreast"],
    "로얄 살루트": ["royalsalute", "로얄살루트"],
    "시바스 리갈": ["chivasregal", "시바스리갈"],
    "발렌타인": ["ballantine", "ballantines"],
    "탈리스커": ["talisker"],
    "라가불린": ["lagavulin"],
    "보모어": ["bowmore"],
    "오번": ["oban"],
    "글렌드로낙": ["glendronach"],
    "글렌파클라스": ["glenfarclas"],
    "글렌알라키": ["glenallachie"],
    "하이랜드 파크": ["highlandpark", "하이랜드파크"],
    "아드벡": ["ardbeg"],
    "라프로익": ["laphroaig"],
}

NAME_ALIASES = {
    "블루": ["blue"],
    "블랙": ["black"],
    "골드": ["gold"],
    "라벨": ["label"],
    "더블우드": ["doublewood", "double wood"],
    "캐리비안": ["caribbean", "caribbean cask"],
    "더블캐스크": ["doublecask", "double cask"],
    "오리지널": ["original"],
    "라산타": ["lasanta"],
    "클래식": ["classic"],
    "비노 바리끄": ["vino", "barrique", "solist"],
    "솔리스트": ["solist"],
    "치타": ["chita"],
    "아오": ["ao"],
    "하모니": ["harmony"],
    "세션": ["session"],
    "프롬 더 배럴": ["from the barrel", "fromthebarrel"],
    "요이치": ["yoichi"],
    "미야기쿄": ["miyagikyo"],
    "트레디션": ["tradition", "iwai"],
    "이글레어": ["eagle rare", "eaglerare"],
    "올드 no7": ["old no.7", "old no7", "old7", "블랙"],
    "켄터키": ["makers"],
    "디스틸러 셀렉트": ["distiller", "woodford"],
    "레드브레스트": ["redbreast"],
}


def normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[()[\]{}]", " ", text)
    text = re.sub(r"ml", "", text, flags=re.I)
    text = re.sub(r"[^0-9a-z가-힣]", "", text, flags=re.I)
    return text.strip()


def volume_of(text: str) -> int | None:
    liter = re.search(r"(\d+(?:\.\d+)?)\s*l\b", text, re.I)
    if liter and "ml" not in liter.group(0).lower():
        n = float(liter.group(1)) * 1000
        if 200 <= n <= 2000:
            return int(n)
    ml = re.search(r"(\d{2,4})\s*ml", text, re.I)
    if ml:
        return int(ml.group(1))
    return None


def year_of(text: str) -> str | None:
    yo = re.search(r"(\d{1,2})\s*(?:년|year|yo)\b", text, re.I)
    return yo.group(1) if yo else None


def _brand_hit(brand: str, hay: str, raw: str) -> bool:
    n = normalize(brand)
    if n and n in hay:
        return True
    return any(
        normalize(alias) in hay or alias.lower() in raw.lower()
        for alias in BRAND_ALIASES.get(brand, [])
    )


def _token_hit(token: str, hay: str, raw: str) -> bool:
    n = normalize(token)
    if len(n) >= 2 and n in hay:
        return True
    aliases = NAME_ALIASES.get(token) or NAME_ALIASES.get(token.replace(" ", "")) or []
    return any(normalize(alias) in hay or alias.lower() in raw.lower() for alias in aliases)


def score_offer(product: dict, offer: dict) -> int:
    raw = f"{offer.get('title', '')} {offer.get('url', '')}"
    hay = normalize(raw)
    if not _brand_hit(product["brand"], hay, raw):
        return 0
    offer_ml = volume_of(offer.get("title") or "")
    if offer_ml and offer_ml != product["volumeMl"]:
        return 0
    product_year = year_of(product["name"])
    offer_year = year_of(offer.get("title") or "")
    if product_year and offer_year and product_year != offer_year:
        return 0
    score = 45
    if product_year and (f"{product_year}년" in hay or product_year in hay):
        score += 25
    if offer_ml == product["volumeMl"] or str(product["volumeMl"]) in hay:
        score += 25
    tokens = [t for t in product["name"].split() if len(t) >= 2 and not re.match(r"^\d+년$", t)]
    token_hits = 0
    for token in tokens:
        if _token_hit(token, hay, raw):
            token_hits += 1
            score += 12
    if tokens and token_hits == 0 and len(offer.get("title") or "") > 28:
        return 0
    return score


def pick_best(product: dict, offers: list[dict]) -> dict | None:
    best = None
    best_score = -1
    for offer in offers:
        if offer.get("saleUsd") is None:
            continue
        score = score_offer(product, offer)
        if score < 45:
            continue
        if score > best_score or (
            score == best_score and offer.get("imageUrl") and not (best or {}).get("imageUrl")
        ):
            best = offer
            best_score = score
    return best


def to_usd(value) -> float | None:
    if isinstance(value, (int, float)) and 0 < value < 20000:
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r"[US$＄,\s]", "", value, flags=re.I)
        try:
            n = float(cleaned)
        except ValueError:
            return None
        if 0 < n < 20000:
            return n
    return None


def mall_from_url(url: str) -> str | None:
    if "lottedfs.com" in url:
        return "lotte"
    if "shilladfs.com" in url:
        return "shilla"
    if "ssgdfs.com" in url:
        return "shinsegae"
    return None


def _host(mall_id: str) -> str:
    return {
        "lotte": "https://kor.lottedfs.com",
        "shilla": "https://www.shilladfs.com",
        "shinsegae": "https://www.ssgdfs.com",
    }[mall_id]


def _absolute(mall_id: str, raw: str) -> str:
    if raw.startswith("//"):
        return f"https:{raw}"
    if raw.startswith("http"):
        return raw
    if raw.startswith("/"):
        return _host(mall_id) + raw
    return raw


def _image_from_record(mall_id: str, rec: dict) -> str | None:
    keys = [
        "prdImg", "imgUrl", "godImg", "thnlPath", "imageUrl", "imgPath", "image",
        "thumbImg", "thumnailUrl", "thumbnail", "img", "mainImg", "goosImg", "productImg",
    ]
    raw = next((rec[k] for k in keys if isinstance(rec.get(k), str) and len(rec[k]) > 8), None)
    if not isinstance(raw, str) or raw.startswith("data:"):
        return None
    return _absolute(mall_id, raw)


def _product_url(mall_id: str, rec: dict) -> str:
    keys = ["url", "prdUrl", "goosUrl", "linkUrl", "detailUrl", "godUrl", "itemUrl"]
    raw = next((rec[k] for k in keys if isinstance(rec.get(k), str) and len(rec[k]) > 3), None)
    if isinstance(raw, str):
        if raw.startswith("http"):
            return raw
        if raw.startswith("/"):
            return _host(mall_id) + raw
    pid = rec.get("prdId") or rec.get("goosId") or rec.get("godId") or rec.get("productId") or rec.get("id") or rec.get("sku")
    if pid is None:
        return ""
    if mall_id == "lotte":
        return f"https://kor.lottedfs.com/kr/product/{pid}"
    if mall_id == "shilla":
        return f"https://www.shilladfs.com/estore/kr/ko/p/{pid}"
    return f"https://www.ssgdfs.com/kr/product/productDetail?sku={pid}"


def harvest_json(data, mall_id: str) -> list[dict]:
    out: list[dict] = []

    def visit(node, depth: int):
        if depth > 10 or not isinstance(node, (dict, list)):
            return
        if isinstance(node, list):
            for item in node:
                visit(item, depth + 1)
            return
        rec = node
        title_parts = [
            rec.get(k)
            for k in [
                "brndNm", "brandNm", "brandName", "brand", "prdNm", "goosNm", "godNm",
                "productName", "goodsNm", "prdName", "itemNm", "itemName", "name",
            ]
            if isinstance(rec.get(k), str)
        ]
        title = " ".join(title_parts)
        nums = [
            n
            for n in (
                to_usd(rec.get(k))
                for k in [
                    "salePrc", "salePrice", "dcPrc", "discountPrice", "lastPrc", "lastSalePrc",
                    "goosPrc", "nrmlPrc", "normalPrice", "csmrPrc", "prc", "price", "usdPrc",
                    "usSalePrc", "maxDcPrc", "onlinePrc", "memberPrc", "finalPrc", "benefitPrc",
                    "splprc", "sellprc", "splPrc",
                ]
            )
            if n is not None
        ]
        if len(title.replace(" ", "")) > 2 and nums:
            out.append(
                {
                    "mallId": mall_id,
                    "title": title[:200],
                    "url": _product_url(mall_id, rec),
                    "originalUsd": max(nums),
                    "saleUsd": min(nums),
                    "imageUrl": _image_from_record(mall_id, rec),
                }
            )
        for value in rec.values():
            visit(value, depth + 1)

    visit(data, 0)
    return out
