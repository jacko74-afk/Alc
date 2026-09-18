from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from stapp.config import CATALOG_FILE, DATA_DIR


def _as_products(value) -> list[dict] | None:
    if not isinstance(value, list) or not value:
        return None
    if not all(isinstance(item, dict) and item.get("id") for item in value):
        return None
    return value


def read_catalog() -> dict | None:
    try:
        raw = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if isinstance(raw, list):
        products = _as_products(raw)
        if not products:
            return None
        return {"savedAt": "", "products": products}
    if isinstance(raw, dict):
        products = _as_products(raw.get("products"))
        if not products:
            return None
        return {"savedAt": raw.get("savedAt") or "", "products": products}
    return None


def write_catalog(products: list[dict]) -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "savedAt": datetime.now(timezone.utc).isoformat(),
        "products": deepcopy(products),
    }
    CATALOG_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return payload


def catalog_or_empty() -> dict:
    return read_catalog() or {"savedAt": "", "products": []}
