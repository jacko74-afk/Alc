from __future__ import annotations

import json
import os
import threading
import time

import streamlit as st

from stapp.catalog import catalog_or_empty, write_catalog
from stapp.config import ADMIN_PASSWORD, DEFAULT_SEED_COUNT, MALLS
from stapp.money import format_krw, original_usd
from stapp.products import ALL_PRODUCTS, SEED_COUNT_OPTIONS, take_products
from stapp.scraper import read_progress, scrape_in_background, set_scrape_cancel, write_progress
from stapp.ui import inject_css


def _expected_password() -> str:
    return os.environ.get("ADMIN_PASSWORD") or os.environ.get("NEXT_PUBLIC_ADMIN_PASSWORD") or ADMIN_PASSWORD


def _rate() -> float:
    if "usd_krw" not in st.session_state:
        from stapp.money import fetch_usd_krw

        st.session_state.usd_krw = fetch_usd_krw()
    return st.session_state.usd_krw


def _to_editor(items: list[dict]) -> list[dict]:
    rows = []
    for item in items:
        row = {
            "id": item["id"],
            "상품": f'{item["brand"]} {item["name"]}',
        }
        for mall in MALLS:
            listing = (item.get("listings") or {}).get(mall["id"]) or {}
            adult = listing.get("adultOnly") or {}
            row[f'{mall["label"]} 원래'] = original_usd(listing)
            row[f'{mall["label"]} 성인'] = adult.get("priceUsd")
        rows.append(row)
    return rows


def _from_editor(rows, items: list[dict]) -> list[dict]:
    if hasattr(rows, "to_dict"):
        rows = rows.to_dict("records")
    by_id = {item["id"]: item for item in items}
    next_items = []
    for row in rows:
        item = by_id.get(row["id"])
        if not item:
            continue
        listings = item.setdefault("listings", {})
        for mall in MALLS:
            listing = listings.setdefault(
                mall["id"],
                {"url": "", "adultOnly": {"priceUsd": None}, "loggedIn": {"priceUsd": None}},
            )
            adult = listing.setdefault("adultOnly", {})
            orig = row.get(f'{mall["label"]} 원래')
            adult_price = row.get(f'{mall["label"]} 성인')
            adult["originalUsd"] = None if orig in ("", None) else float(orig)
            adult["priceUsd"] = None if adult_price in ("", None) else float(adult_price)
        next_items.append(item)
    return next_items


def _load_admin_items():
    catalog = catalog_or_empty()
    if catalog["products"]:
        st.session_state.admin_items = catalog["products"]
        st.session_state.seed_count = len(catalog["products"])
        return
    count = st.session_state.get("seed_count", DEFAULT_SEED_COUNT)
    st.session_state.admin_items = take_products(count)


def render_admin():
    inject_css()
    st.markdown('<div class="df-hero"><div class="kicker">ADMIN CELLAR</div><h1>가격 관리</h1></div>', unsafe_allow_html=True)

    if not st.session_state.get("admin_ok"):
        st.write("기본 비밀번호는 `admin` 입니다. 환경변수 `ADMIN_PASSWORD`로 바꿀 수 있습니다.")
        password = st.text_input("비밀번호", type="password")
        if st.button("들어가기", type="primary"):
            if password != _expected_password():
                st.error("비밀번호가 올바르지 않습니다.")
            else:
                st.session_state.admin_ok = True
                st.session_state.admin_password = password
                _load_admin_items()
                st.rerun()
        return

    if "admin_items" not in st.session_state:
        _load_admin_items()

    st.write(
        "성인인증가만 가져옵니다. 수집이 끝나면 `data/live-prices.json`에 저장되며, "
        "셀러는 이 JSON 파일을 불러 비교합니다. 표 내용을 수정한 뒤에는 JSON 파일 저장을 누르세요."
    )

    options = SEED_COUNT_OPTIONS
    current = st.session_state.get("seed_count", DEFAULT_SEED_COUNT)
    if current not in options:
        options = sorted({*options, current})
    seed_count = st.selectbox(
        "시드 개수",
        options,
        index=options.index(current) if current in options else options.index(DEFAULT_SEED_COUNT),
        format_func=lambda n: f"전체 {n}개" if n == len(ALL_PRODUCTS) else f"{n}개",
    )
    st.caption(f"기본 {DEFAULT_SEED_COUNT}개 · 현재 {len(st.session_state.admin_items)} / {len(ALL_PRODUCTS)}")
    if seed_count != st.session_state.get("seed_count"):
        st.session_state.seed_count = seed_count
        st.session_state.admin_items = take_products(seed_count, st.session_state.admin_items)
        st.info(f"시드를 {seed_count}개로 맞췄습니다. 수집하거나 JSON 파일 저장을 누르면 셀러에 반영됩니다.")

    progress = read_progress()
    scraping = not progress.get("done", True)

    c1, c2, c3, c4, c5, c6 = st.columns(6)
    with c1:
        start = st.button("실제 가격 수집 (성인)", type="primary", disabled=scraping)
    with c2:
        stop = st.button("수집 중단", disabled=not scraping)
    with c3:
        save = st.button("JSON 파일 저장", disabled=scraping)
    with c4:
        reload_json = st.button("저장된 JSON 불러오기", disabled=scraping)
    with c5:
        restore = st.button("시드 되돌리기")
    with c6:
        st.download_button(
            "JSON 내려받기",
            data=json.dumps(st.session_state.admin_items, ensure_ascii=False, indent=2),
            file_name="live-prices.json",
            mime="application/json",
        )

    if start:
        set_scrape_cancel(False)
        write_progress(["수집 요청을 보냈습니다. 곧 브라우저가 열립니다."], False)
        threading.Thread(
            target=scrape_in_background,
            args=(st.session_state.get("seed_count", DEFAULT_SEED_COUNT),),
            daemon=True,
        ).start()
        st.session_state.scraping = True
        st.rerun()

    if stop:
        set_scrape_cancel(True)
        st.warning("중단 신호를 보냈습니다. 잠시 후 지금까지 모은 가격이 저장됩니다.")

    if save:
        write_catalog(st.session_state.admin_items)
        st.success(
            f"{len(st.session_state.admin_items)}개를 live-prices.json에 저장했습니다. 셀러에서 이 파일을 불러 비교합니다."
        )

    if reload_json:
        catalog = catalog_or_empty()
        if not catalog["products"]:
            st.warning("저장된 JSON 파일이 없습니다. 먼저 수집하거나 JSON 파일 저장을 하세요.")
        else:
            st.session_state.admin_items = catalog["products"]
            st.session_state.seed_count = len(catalog["products"])
            st.success(f"live-prices.json에서 {len(catalog['products'])}개를 불러왔습니다.")
            st.rerun()

    if restore:
        st.session_state.admin_items = take_products(st.session_state.get("seed_count", DEFAULT_SEED_COUNT))
        st.info("시드 데이터로 되돌렸습니다. 셀러에 반영하려면 JSON 파일 저장을 누르세요.")

    logs = progress.get("logs") or []
    if logs:
        st.code("\n".join(logs), language="text")
    if scraping:
        st.caption("수집 중입니다. 열린 Chromium 창에서 성인인증만 하세요.")
        time.sleep(2)
        catalog = catalog_or_empty()
        if catalog["products"] and progress.get("done"):
            st.session_state.admin_items = catalog["products"]
        st.rerun()
    elif st.session_state.get("scraping"):
        st.session_state.scraping = False
        catalog = catalog_or_empty()
        if catalog["products"]:
            st.session_state.admin_items = catalog["products"]
            st.session_state.seed_count = len(catalog["products"])
            st.success(
                f"성인인증가 {len(catalog['products'])}개를 live-prices.json에 저장했습니다. 셀러는 이 JSON을 불러 비교합니다."
            )

    rate = _rate()
    edited = st.data_editor(
        _to_editor(st.session_state.admin_items),
        hide_index=True,
        width="stretch",
        num_rows="fixed",
        disabled=["id", "상품"],
        key=f"admin_editor_{len(st.session_state.admin_items)}",
    )
    if edited is not None:
        st.session_state.admin_items = _from_editor(edited, st.session_state.admin_items)

    st.caption("원화는 입력한 달러 기준 환산입니다.")
    for item in st.session_state.admin_items[:3]:
        bits = []
        for mall in MALLS:
            listing = (item.get("listings") or {}).get(mall["id"]) or {}
            adult = listing.get("adultOnly") or {}
            orig = original_usd(listing)
            bits.append(
                f'{mall["label"]} 원래 {format_krw(orig, rate)} / 성인 {format_krw(adult.get("priceUsd"), rate)}'
            )
        st.caption(f'{item["brand"]} {item["name"]} · ' + " · ".join(bits))
