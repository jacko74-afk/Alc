from __future__ import annotations

from copy import deepcopy
from urllib.parse import quote

from stapp.config import DEFAULT_SEED_COUNT, FALLBACK_URLS

LOTTE = FALLBACK_URLS["lotte"]
SHILLA = FALLBACK_URLS["shilla"]
SHINSEGAE = FALLBACK_URLS["shinsegae"]


def _wm(file: str) -> str:
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{quote(file)}?width=320"


SEED_IMAGES = {
    "jw-blue-750": _wm("Johnnie Walker Blue Label.jpg"),
    "jw-black-1000": _wm("Johnnie Walker Black Label.jpg"),
    "jw-gold-750": _wm("Johnnie Walker Gold Label Reserve.jpg"),
    "balvenie-12-700": _wm("The Balvenie DoubleWood 12.jpg"),
    "glenfiddich-12-700": _wm("Glenfiddich 12 Year Old.jpg"),
    "glenfiddich-15-700": _wm("Glenfiddich 15 Year Old.jpg"),
    "glenfiddich-18-700": _wm("Glenfiddich 18 Year Old.jpg"),
    "glenlivet-12-700": _wm("The Glenlivet 12 Year Old.jpg"),
    "glenmorangie-original-1000": _wm("Glenmorangie Original.jpg"),
    "macallan-12-700": _wm("The Macallan 12 Years Old.jpg"),
    "macallan-18-700": _wm("The Macallan 18 Year Old.jpg"),
    "kavalan-classic-700": _wm("Kavalan whisky.jpg"),
    "suntory-chita-700": _wm("The Chita whisky.jpg"),
    "hibiki-harmony-700": _wm("Hibiki Harmony.jpg"),
    "yamazaki-12-700": _wm("Yamazaki 12 Years.jpg"),
    "hakushu-12-700": _wm("Hakushu 12 Year Old.jpg"),
    "nikka-from-barrel-500": _wm("Nikka From The Barrel.jpg"),
    "yoichi-700": _wm("Yoichi Single Malt.jpg"),
    "jack-old-no7-1000": _wm("Jack Daniel's Old No.7.jpg"),
    "makers-mark-750": _wm("Maker's Mark bottle.jpg"),
    "woodford-reserve-700": _wm("Woodford Reserve.jpg"),
    "wild-turkey-101-700": _wm("Wild Turkey 101.jpg"),
    "jameson-700": _wm("Jameson Irish Whiskey.jpg"),
    "bushmills-10-700": _wm("Bushmills 10 Year Old.jpg"),
    "redbreast-12-700": _wm("Redbreast 12.jpg"),
    "royal-salute-21-700": _wm("Royal Salute 21 Year Old.jpg"),
    "chivas-18-700": _wm("Chivas Regal 18.jpg"),
    "ballantine-21-700": _wm("Ballantine's 21 Year Old.jpg"),
    "talisker-10-700": _wm("Talisker 10 Year Old.jpg"),
    "lagavulin-16-700": _wm("Lagavulin 16 Year Old.jpg"),
    "bowmore-12-700": _wm("Bowmore 12 Year Old.jpg"),
    "oban-14-700": _wm("Oban 14 Year Old.jpg"),
    "ardbeg-10-700": _wm("Ardbeg Ten.jpg"),
    "laphroaig-10-700": _wm("Laphroaig 10 Year Old.jpg"),
    "highland-park-12-700": _wm("Highland Park 12 Year Old.jpg"),
}


def _listing(adult, member, original, url):
    return {
        "url": url,
        "adultOnly": {"priceUsd": adult, "originalUsd": original},
        "loggedIn": {"priceUsd": member, "originalUsd": original},
    }


# id, brand, name, ml, category, lotte[adult,member,orig], shilla, shinsegae
ROWS = [
    ("jw-blue-750", "조니워커", "블루 라벨", 750, "scotch", [189, 175, 280], [185, 185, 280], [192, 178, 280]),
    ("jw-black-1000", "조니워커", "블랙 라벨", 1000, "scotch", [32, 29, 48], [31, 31, 48], [33, 30, 48]),
    ("jw-gold-750", "조니워커", "골드 라벨", 750, "scotch", [48, 44, 72], [46, 46, 72], [49, 45, 72]),
    ("balvenie-12-700", "발베니", "12년 더블우드", 700, "scotch", [89, 82, 120], [85, 85, 120], [88, 84, 120]),
    ("balvenie-14-700", "발베니", "14년 캐리비안 캐스크", 700, "scotch", [98, 91, 135], [96, 96, 135], [99, 92, 135]),
    ("balvenie-15-700", "발베니", "15년", 700, "scotch", [118, 109, 160], [112, 112, 160], [115, 108, 160]),
    ("glenfiddich-12-700", "글렌피딕", "12년", 700, "scotch", [38, 35, 55], [37, 37, 55], [39, 36, 55]),
    ("glenfiddich-15-700", "글렌피딕", "15년", 700, "scotch", [58, 54, 82], [56, 56, 82], [59, 55, 82]),
    ("glenfiddich-18-700", "글렌피딕", "18년", 700, "scotch", [80.18, 80.18, 148], [82, 76, 148], [81, 79, 148]),
    ("glenfiddich-21-700", "글렌피딕", "21년", 700, "scotch", [142.29, 136, 264], [145, 145, 264], [148, 139, 264]),
    ("glenlivet-12-700", "글렌리벳", "12년", 700, "scotch", [42, 39, 62], [41, 41, 62], [43, 40, 62]),
    ("glenlivet-18-700", "글렌리벳", "18년", 700, "scotch", [88, 81, 130], [85, 85, 130], [87, 82, 130]),
    ("glenmorangie-original-1000", "글렌모렌지", "오리지널", 1000, "scotch", [38, 36, 52], [36, 36, 52], [39, 35.5, 52]),
    ("glenmorangie-lasanta-700", "글렌모렌지", "라산타 12년", 700, "scotch", [52, 48, 74], [50, 50, 74], [53, 49, 74]),
    ("macallan-12-700", "맥캘란", "12년 더블캐스크", 700, "scotch", [98, 91, 140], [95, 95, 140], [99, 92, 140]),
    ("macallan-15-700", "맥캘란", "15년 더블캐스크", 700, "scotch", [168, 155, 230], [162, 162, 230], [170, 158, 230]),
    ("macallan-18-700", "맥캘란", "18년", 700, "scotch", [268, 255, 390], [262, 262, 390], [270, 248, 390]),
    ("kavalan-12-700", "카발란", "12년 더블캐스크", 700, "other", [72, 68, 110], [None, 70, 110], [74, 69, 110]),
    ("kavalan-classic-700", "카발란", "클래식", 700, "other", [48, 45, 72], [47, 47, 72], [49, 46, 72]),
    ("kavalan-vino-1000", "카발란", "비노 바리끄 솔리스트", 1000, "other", [138, 138, 230], [142, 132, 230], [140, 135, 230]),
    ("suntory-chita-700", "산토리", "치타", 700, "japanese", [36, 33, 48], [35.07, 35.07, 48], [37, 34, 48]),
    ("suntory-ao-700", "산토리", "아오", 700, "japanese", [58, 54, 82], [56, 56, 82], [59, 55, 82]),
    ("hibiki-harmony-700", "히비키", "하모니", 700, "japanese", [78, 72, 115], [76, 76, 115], [79, 73, 115]),
    ("yamazaki-12-700", "야마자키", "12년", 700, "japanese", [None, 128, 180], [132, 132, 180], [135, 125, 180]),
    ("hakushu-12-700", "하쿠슈", "12년", 700, "japanese", [118, 110, 165], [115, 115, 165], [120, 112, 165]),
    ("nikka-session-700", "닛카", "더 세션", 700, "japanese", [44, 41, 58], [42.27, 42.27, 58], [43, 40, 58]),
    ("nikka-from-barrel-500", "닛카", "프롬 더 배럴", 500, "japanese", [38, 35, 52], [37, 37, 52], [39, 36, 52]),
    ("yoichi-700", "닛카", "요이치 싱글몰트", 700, "japanese", [72, 67, 98], [70, 70, 98], [73, 68, 98]),
    ("miyagikyo-700", "닛카", "미야기쿄 싱글몰트", 700, "japanese", [68, 63, 94], [66, 66, 94], [69, 64, 94]),
    ("mars-iwai-700", "마르스", "이와이 트레디션", 700, "japanese", [34, 32, 45], [32.5, 32.5, 45], [None, 33, 45]),
    ("buffalo-eagle-rare-750", "버팔로 트레이스", "이글레어 10년", 750, "bourbon", [31.84, 31.84, 58], [33, 30, 58], [32, 31, 58]),
    ("jack-old-no7-1000", "잭 다니엘", "올드 No.7", 1000, "bourbon", [22, 20, 32], [21, 21, 32], [22.5, 19.8, 32]),
    ("makers-mark-750", "메이커스 마크", "켄터키 스트레이트", 750, "bourbon", [28, 26, 42], [27, 27, 42], [29, 25.5, 42]),
    ("woodford-reserve-700", "우드포드 리저브", "디스틸러 셀렉트", 700, "bourbon", [36, 33, 52], [35, 35, 52], [37, 34, 52]),
    ("wild-turkey-101-700", "와일드 터키", "101", 700, "bourbon", [24, 22, 36], [23, 23, 36], [25, 21.5, 36]),
    ("jameson-700", "제임슨", "오리지널", 700, "irish", [22, 20, 34], [21, 21, 34], [23, 19.5, 34]),
    ("jameson-18-700", "제임슨", "18년", 700, "irish", [78, 72, 105], [75, 75, 105], [77, 71, 105]),
    ("bushmills-10-700", "부쉬밀스", "10년", 700, "irish", [32, 29, 46], [31, 31, 46], [33, 30, 46]),
    ("redbreast-12-700", "레드브레스트", "12년", 700, "irish", [52, 48, 74], [50, 50, 74], [53, 49, 74]),
    ("royal-salute-21-700", "로얄 살루트", "21년", 700, "scotch", [128, 118, 190], [124, 124, 190], [126, 119, 190]),
    ("chivas-18-700", "시바스 리갈", "18년", 700, "scotch", [72, 66, 108], [70, 70, 108], [73, 67, 108]),
    ("ballantine-21-700", "발렌타인", "21년", 700, "scotch", [98, 90, 145], [95, 95, 145], [99, 91, 145]),
    ("talisker-10-700", "탈리스커", "10년", 700, "scotch", [48, 44, 68], [46, 46, 68], [49, 45, 68]),
    ("lagavulin-16-700", "라가불린", "16년", 700, "scotch", [88, 81, 128], [85, 85, 128], [87, 82, 128]),
    ("bowmore-12-700", "보모어", "12년", 700, "scotch", [42, 39, 62], [41, 41, 62], [43, 40, 62]),
    ("oban-14-700", "오번", "14년", 700, "scotch", [78, 72, 112], [76, 76, 112], [79, 73, 112]),
    ("glendronach-12-700", "글렌드로낙", "12년", 700, "scotch", [58, 54, 82], [56, 56, 82], [59, 55, 82]),
    ("glenfarclas-105-700", "글렌파클라스", "105", 700, "scotch", [54, 50, 78], [52, 52, 78], [55, 51, 78]),
    ("glenallachie-12-700", "글렌알라키", "12년", 700, "scotch", [62, 57, 88], [60, 60, 88], [63, 58, 88]),
    ("glenallachie-15-700", "글렌알라키", "15년", 700, "scotch", [82, 76, 118], [80, 80, 118], [83, 77, 118]),
    ("highland-park-12-700", "하이랜드 파크", "12년", 700, "scotch", [42, 39, 58], [40, 40, 58], [41, 38, 58]),
    ("ardbeg-10-700", "아드벡", "10년", 700, "scotch", [48, 45, 68], [46, 46, 68], [47, 44, 68]),
    ("laphroaig-10-700", "라프로익", "10년", 700, "scotch", [46, 43, 64], [44, 44, 64], [45, 42, 64]),
]


def _from_row(row) -> dict:
    pid, brand, name, volume, category, lotte, shilla, shinsegae = row
    return {
        "id": pid,
        "brand": brand,
        "name": name,
        "volumeMl": volume,
        "category": category,
        "updatedAt": "2026-03-18",
        "isSamplePrice": True,
        "imageUrl": SEED_IMAGES.get(pid),
        "listings": {
            "lotte": _listing(*lotte, LOTTE),
            "shilla": _listing(*shilla, SHILLA),
            "shinsegae": _listing(*shinsegae, SHINSEGAE),
        },
    }


ALL_PRODUCTS = [_from_row(row) for row in ROWS]
SEED_COUNT_OPTIONS = sorted({n for n in (10, 20, 30, 40, len(ALL_PRODUCTS)) if n <= len(ALL_PRODUCTS)})


def take_products(count: int, live: list[dict] | None = None) -> list[dict]:
    n = min(max(1, int(count)), len(ALL_PRODUCTS))
    by_id = {item["id"]: item for item in (live or [])}
    return [deepcopy(by_id.get(item["id"], item)) for item in ALL_PRODUCTS[:n]]
