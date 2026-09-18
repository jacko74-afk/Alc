from pathlib import Path

from stapp.config import ROOT
from stapp.money import product_image

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Manrope:wght@400;600&display=swap');
html, body, [data-testid="stAppViewContainer"] {
  background: #f4eadc;
  color: #2a211b;
  font-family: Manrope, sans-serif;
}
[data-testid="stHeader"] { background: #1c1410; }
.block-container { padding-top: 1.4rem; max-width: 1180px; }
h1, h2, h3, .df-display {
  font-family: "Cormorant Garamond", serif;
}
.df-hero {
  background: linear-gradient(135deg, #1c1410, #3a1d22);
  color: #f4eadc;
  border: 1px solid rgba(212,175,106,.28);
  border-radius: 18px;
  padding: 28px 32px;
  margin-bottom: 16px;
}
.df-hero .kicker {
  letter-spacing: .38em;
  font-size: 11px;
  color: #d4af6a;
}
.df-hero h1 { margin: 8px 0 0; font-size: 2.1rem; }
.df-hero p { color: rgba(244,234,220,.75); max-width: 680px; }
.df-legend {
  background: linear-gradient(90deg, #f8e9ea, #f7edd8);
  border: 1px solid rgba(212,175,106,.35);
  border-radius: 12px;
  padding: 12px 16px;
  margin: 8px 0 16px;
  color: #3a1d22;
}
.df-card {
  background: #fff8ef;
  border: 1px solid rgba(212,175,106,.28);
  border-radius: 16px;
  padding: 12px;
  margin-bottom: 10px;
}
.df-price { font-size: 13px; line-height: 1.45; }
.df-best { color: #7a1f2b; font-weight: 700; background: #f8e9ea; border-radius: 8px; padding: 8px 10px; }
.df-orig { color: rgba(42,33,27,.45); font-size: 11px; }
.df-adult { color: #2a211b; }
.df-low { color: #7a1f2b; font-weight: 700; }
.df-meta { color: #8a6a2b; font-size: 12px; }
.df-empty {
  text-align: center;
  background: #fff8ef;
  border: 1px solid rgba(212,175,106,.28);
  border-radius: 16px;
  padding: 40px 20px;
}
.df-mall {
  background: #fff8ef;
  border: 1px solid rgba(212,175,106,.28);
  border-radius: 14px;
  padding: 16px;
}
.df-mall.win { box-shadow: 0 0 0 1px #d4af6a; }
.df-gate {
  max-width: 460px;
  margin: 8vh auto;
  background: #1c1410;
  color: #f4eadc;
  border: 1px solid rgba(212,175,106,.3);
  border-radius: 18px;
  padding: 32px;
}
.df-gate .kicker { letter-spacing: .32em; color: #d4af6a; font-size: 11px; }
.df-foot { color: rgba(42,33,27,.65); font-size: 12px; margin-top: 28px; }
img.df-bottle { width: 72px; height: 96px; object-fit: contain; background: #1c1410; border-radius: 8px; padding: 4px; }
img.df-bottle-lg { width: 180px; height: 260px; object-fit: contain; background: #1c1410; border-radius: 12px; padding: 8px; }
a.df-link { color: #7a1f2b; text-decoration: none; font-weight: 600; }
</style>
"""


def inject_css() -> None:
    import streamlit as st

    st.markdown(CSS, unsafe_allow_html=True)


def resolve_image(product: dict) -> str | None:
    src = product_image(product)
    if not src:
        return None
    if src.startswith("/bottles/"):
        path = ROOT / "public" / src.lstrip("/")
        return str(path) if path.exists() else None
    return src
