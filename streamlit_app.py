from datetime import datetime, timedelta

import streamlit as st

from stapp.config import AGE_DAYS
from stapp.money import is_adult
from stapp.ui import inject_css
from views.admin import render_admin
from views.cellar import render_cellar

st.set_page_config(
    page_title="면세점 주류 비교",
    page_icon="🍷",
    layout="wide",
    initial_sidebar_state="expanded",
)

inject_css()

st.sidebar.markdown("**DUTY FREE SPIRITS --**")
st.sidebar.caption("면세점 주류 비교")


def age_gate() -> bool:
    until = st.session_state.get("age_until")
    if until and datetime.now().timestamp() < until:
        return True
    st.markdown(
        '<div class="df-gate"><div class="kicker">ADULTS ONLY</div>'
        "<h2>만 19세 이상만 입장할 수 있습니다</h2>"
        "<p>청소년보호법에 따라 주류 정보를 보려면 생년월일 확인이 필요합니다. "
        "이 확인은 면세점 본인인증과 다르며 별도 비용이 없습니다.</p></div>",
        unsafe_allow_html=True,
    )
    with st.form("age_gate"):
        birth = st.text_input("생년월일 8자리", placeholder="19900101", max_chars=8)
        submitted = st.form_submit_button("만 19세 이상입니다", type="primary")
    if submitted:
        digits = "".join(ch for ch in birth if ch.isdigit())[:8]
        if not is_adult(digits):
            st.error("만 19세 미만이거나 생년월일이 올바르지 않습니다.")
            return False
        st.session_state.age_until = (datetime.now() + timedelta(days=AGE_DAYS)).timestamp()
        st.rerun()
    return False


if not age_gate():
    st.stop()

page = st.navigation(
    [
        st.Page(render_cellar, title="셀러", icon="🍷"),
        st.Page(render_admin, title="관리자", icon="🔐"),
    ]
)
page.run()

st.markdown(
    '<div class="df-foot">지나친 음주는 건강을 해칩니다. 이 사이트의 가격은 성인인증 후 보이는 '
    "참고용 금액이며, 실제 판매가·재고는 각 면세점에서 확인하세요. 쿠폰·적립금·카드 할인은 포함하지 "
    "않습니다. 귀국 시 주류 면세 한도는 2병, 총 2L, US$400 이하입니다.</div>",
    unsafe_allow_html=True,
)
