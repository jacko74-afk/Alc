from __future__ import annotations

from datetime import datetime

import streamlit as st

from stapp.catalog import catalog_or_empty
from stapp.config import CATEGORIES, MALL_LABEL, MALLS
from stapp.money import lowest_for, money, original_usd, product_lowest_price
from stapp.ui import inject_css, resolve_image


def _rate() -> float:
    if "usd_krw" not in st.session_state:
        from stapp.money import fetch_usd_krw

        st.session_state.usd_krw = fetch_usd_krw()
    return st.session_state.usd_krw


def _legend():
    st.markdown(
        '<div class="df-legend">각 면세점 칸은 <b>원래가</b>와 <b>성인인증가</b>입니다. '
        "가격은 달러와 원화(환율 환산)를 함께 보여 줍니다. 비교 목록은 관리자가 저장한 JSON "
        "파일을 불러옵니다. 회원 로그인은 하지 않습니다.</div>",
        unsafe_allow_html=True,
    )


def _price_cell(product: dict, mall_id: str, rate: float) -> str:
    listing = (product.get("listings") or {}).get(mall_id)
    if not listing:
        return '<span style="opacity:.4">미입점</span>'
    original = original_usd(listing)
    adult = (listing.get("adultOnly") or {}).get("priceUsd")
    best = lowest_for(product)
    low = best and best["mallId"] == mall_id
    orig_html = money(original, rate) if original is not None else "—"
    adult_cls = "df-low" if low else "df-adult"
    return (
        f'<div class="df-price"><div class="df-orig">원래가 {orig_html}</div>'
        f'<div class="{adult_cls}">성인 {money(adult, rate)}</div></div>'
    )


def render_detail(product: dict, rate: float):
    if st.button("← 셀러로"):
        st.session_state.pop("selected_id", None)
        st.query_params.clear()
        st.rerun()
    img = resolve_image(product)
    left, right = st.columns([1, 2])
    with left:
        if img:
            st.image(img, width="stretch")
        else:
            st.markdown("🍾")
    with right:
        st.caption(product["brand"])
        st.markdown(f'<h1 class="df-display">{product["name"]}</h1>', unsafe_allow_html=True)
        sample = " · 샘플 가격" if product.get("isSamplePrice") else ""
        st.write(f'{product["volumeMl"]}ml · 업데이트 {product.get("updatedAt", "-")}{sample}')
        _legend()
    best = lowest_for(product)
    cols = st.columns(3)
    for mall, col in zip(MALLS, cols):
        listing = (product.get("listings") or {}).get(mall["id"])
        with col:
            win = best and best["mallId"] == mall["id"]
            st.markdown(
                f'<div class="df-mall{" win" if win else ""}"><h3>{mall["label"]}</h3>'
                + ('<p class="df-low">최저 성인가</p>' if win else ""),
                unsafe_allow_html=True,
            )
            if not listing:
                st.write("미입점")
            else:
                original = original_usd(listing)
                adult = (listing.get("adultOnly") or {}).get("priceUsd")
                st.caption("원래가")
                st.write(money(original, rate) if original is not None else "—")
                st.caption("성인인증가")
                st.markdown(f'<p class="df-low" style="font-size:1.4rem">{money(adult, rate)}</p>', unsafe_allow_html=True)
                st.link_button(f'{mall["label"]}에서 확인', listing.get("url") or "#")
            st.markdown("</div>", unsafe_allow_html=True)
    st.markdown(
        '<div class="df-hero" style="margin-top:18px"><h3>면세 반입 한도 (귀국 시)</h3>'
        "<p>주류는 일반 면세 한도 US$800과 별도로, 2병·총 2L·US$400 이하까지 면세입니다. "
        "초과분은 세관 신고 대상입니다.</p></div>",
        unsafe_allow_html=True,
    )


def render_cellar():
    inject_css()
    rate = _rate()
    catalog = catalog_or_empty()
    products = catalog["products"]
    selected = st.session_state.get("selected_id") or st.query_params.get("product")
    if selected:
        found = next((p for p in products if p["id"] == selected), None)
        if found:
            render_detail(found, rate)
            return
        st.warning("저장된 JSON에서 상품을 찾을 수 없습니다.")
        st.session_state.pop("selected_id", None)

    st.markdown(
        '<div class="df-hero"><div class="kicker">LOTTE · SHILLA · SHINSEGAE</div>'
        "<h1>세 면세점 위스키를 한 셀러에서</h1>"
        "<p>만 19세 확인 후 성인인증가를 비교합니다. 비교 가격은 관리자가 저장한 JSON 파일에서 불러옵니다.</p></div>",
        unsafe_allow_html=True,
    )
    _legend()

    if not products:
        st.markdown(
            '<div class="df-empty"><h3>저장된 비교 가격이 없습니다</h3>'
            "<p>관리자에서 실제 가격을 수집한 뒤 JSON 파일로 저장하면 여기에 표출됩니다.</p></div>",
            unsafe_allow_html=True,
        )
        return

    saved = catalog.get("savedAt")
    saved_label = ""
    if saved:
        try:
            saved_label = " · 저장 " + datetime.fromisoformat(saved.replace("Z", "+00:00")).astimezone().strftime(
                "%Y-%m-%d %H:%M"
            )
        except ValueError:
            saved_label = f" · 저장 {saved}"
    st.caption(f"관리자 JSON {len(products)}개{saved_label} 를 불러왔습니다. 환율 1USD={rate:,.1f}원")

    query = st.text_input("브랜드·상품명 검색", placeholder="브랜드·상품명 검색")
    cat_labels = [c["label"] for c in CATEGORIES]
    chosen = st.radio("카테고리", cat_labels, horizontal=True, label_visibility="collapsed")
    cat_id = next(c["id"] for c in CATEGORIES if c["label"] == chosen)

    q = query.strip().lower()
    filtered = []
    for product in products:
        if cat_id != "all" and product.get("category") != cat_id:
            continue
        hay = f'{product["brand"]} {product["name"]}'.lower()
        if q and q not in hay:
            continue
        filtered.append(product)
    filtered.sort(key=product_lowest_price)

    if not filtered:
        st.info("검색 결과가 없습니다.")
        return

    header = st.columns([0.7, 1.6, 1.1, 1.1, 1.1, 1.2])
    header[0].markdown("**병**")
    header[1].markdown("**상품**")
    for i, mall in enumerate(MALLS):
        header[i + 2].markdown(f'**{mall["label"]}**')
    header[5].markdown("**최저 성인가**")

    for product in filtered:
        cols = st.columns([0.7, 1.6, 1.1, 1.1, 1.1, 1.2])
        img = resolve_image(product)
        with cols[0]:
            if img:
                st.image(img, width=72)
            else:
                st.write("🍾")
        with cols[1]:
            if st.button(product["brand"], key=f"p-{product['id']}"):
                st.session_state.selected_id = product["id"]
                st.query_params["product"] = product["id"]
                st.rerun()
            st.write(product["name"])
            sample = " · 샘플 가격" if product.get("isSamplePrice") else ""
            st.markdown(
                f'<div class="df-meta">{product["volumeMl"]}ml{sample}</div>',
                unsafe_allow_html=True,
            )
        for i, mall in enumerate(MALLS):
            listing = (product.get("listings") or {}).get(mall["id"])
            with cols[i + 2]:
                st.markdown(_price_cell(product, mall["id"], rate), unsafe_allow_html=True)
                if listing and listing.get("url"):
                    st.markdown(
                        f'<a class="df-link" href="{listing["url"]}" target="_blank">{mall["label"]} 보기</a>',
                        unsafe_allow_html=True,
                    )
        best = lowest_for(product)
        with cols[5]:
            if best:
                st.markdown(
                    f'<div class="df-best">{MALL_LABEL[best["mallId"]]} {money(best["price"], rate)}</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.write("—")
