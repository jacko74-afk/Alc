from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
BOTTLES_DIR = ROOT / "public" / "bottles"
CATALOG_FILE = DATA_DIR / "live-prices.json"
CONTROL_FILE = DATA_DIR / "scrape-control.json"
PROGRESS_FILE = DATA_DIR / "scrape-progress.json"

MALLS = [
    {"id": "lotte", "label": "롯데"},
    {"id": "shilla", "label": "신라"},
    {"id": "shinsegae", "label": "신세계"},
]
MALL_IDS = [m["id"] for m in MALLS]
MALL_LABEL = {m["id"]: m["label"] for m in MALLS}

CATEGORIES = [
    {"id": "all", "label": "전체"},
    {"id": "scotch", "label": "스카치"},
    {"id": "japanese", "label": "일본"},
    {"id": "irish", "label": "아이리시"},
    {"id": "bourbon", "label": "버번"},
    {"id": "other", "label": "기타"},
]

FALLBACK_URLS = {
    "lotte": "https://m.kor.lottedfs.com/kr/display/category/second?dispShopNo1=10055924&dispShopNo2=10055930&treDpth=2",
    "shilla": "https://m.shilladfs.com/estore/kr/ko/c/1211",
    "shinsegae": "https://www.ssgdfs.com/kr/dispctg/ctg/liquor/whisky",
}

DEFAULT_SEED_COUNT = 20
ADMIN_PASSWORD = "1q2w3e"
DEFAULT_USD_KRW = 1370
AGE_DAYS = 30
