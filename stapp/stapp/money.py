from __future__ import annotations

from datetime import date

from stapp.config import DEFAULT_USD_KRW, MALLS


def format_usd(value: float | None) -> str:
    if value is None:
        return "확인 불가"
    if float(value).is_integer():
        return f"${int(value)}"
    return f"${value:.2f}"


def usd_to_krw(usd: float, rate: float = DEFAULT_USD_KRW) -> int:
    return round(usd * rate)


def format_krw(value: float | None, rate: float = DEFAULT_USD_KRW) -> str:
    if value is None:
        return "확인 불가"
    return f"{usd_to_krw(value, rate):,}원"


def money(value: float | None, rate: float = DEFAULT_USD_KRW) -> str:
    if value is None:
        return "확인 불가"
    return f"{format_usd(value)} {format_krw(value, rate)}"


def original_usd(listing: dict | None) -> float | None:
    if not listing:
        return None
    adult = listing.get("adultOnly") or {}
    logged = listing.get("loggedIn") or {}
    value = adult.get("originalUsd")
    if value is None:
        value = logged.get("originalUsd")
    return value


def lowest_for(product: dict) -> dict | None:
    best = None
    listings = product.get("listings") or {}
    for mall in MALLS:
        price = ((listings.get(mall["id"]) or {}).get("adultOnly") or {}).get("priceUsd")
        if price is None:
            continue
        if best is None or price < best["price"]:
            best = {"mallId": mall["id"], "price": price}
    return best


def product_image(product: dict) -> str | None:
    if product.get("imageUrl"):
        return product["imageUrl"]
    listings = product.get("listings") or {}
    for mall in MALLS:
        img = (listings.get(mall["id"]) or {}).get("imageUrl")
        if img:
            return img
    return None


def product_lowest_price(product: dict) -> float:
    best = lowest_for(product)
    return best["price"] if best else float("inf")


def is_adult(birth_ymd: str, today: date | None = None) -> bool:
    if not birth_ymd or len(birth_ymd) != 8 or not birth_ymd.isdigit():
        return False
    year = int(birth_ymd[:4])
    month = int(birth_ymd[4:6])
    day = int(birth_ymd[6:8])
    try:
        birth = date(year, month, day)
    except ValueError:
        return False
    now = today or date.today()
    age = now.year - year
    if (now.month, now.day) < (birth.month, birth.day):
        age -= 1
    return age >= 19


def fetch_usd_krw() -> float:
    try:
        import urllib.request
        import json

        with urllib.request.urlopen(
            "https://api.frankfurter.app/latest?from=USD&to=KRW",
            timeout=6,
        ) as res:
            data = json.loads(res.read().decode("utf-8"))
            rate = (data.get("rates") or {}).get("KRW")
            if isinstance(rate, (int, float)) and rate > 0:
                return float(rate)
    except Exception:
        pass
    return DEFAULT_USD_KRW
