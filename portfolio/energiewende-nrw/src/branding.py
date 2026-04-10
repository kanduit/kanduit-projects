"""Shared Kanduit branding header for all Streamlit pages."""

from __future__ import annotations

import base64

import streamlit as st

from src.config import COMPANY_NAME, LOGO_PATH


def _logo_b64() -> str | None:
    if not LOGO_PATH.exists():
        return None
    return base64.b64encode(LOGO_PATH.read_bytes()).decode()


def render_header() -> None:
    """Render the Kanduit branded header bar at the top of every page."""
    logo = _logo_b64()

    logo_html = (
        f'<img src="data:image/png;base64,{logo}" '
        f'style="height:36px;width:36px;border-radius:50%;object-fit:cover;" />'
        if logo
        else ""
    )

    st.markdown(
        f"""
        <div style="
            display:flex; align-items:center; gap:12px;
            padding:0.6rem 1rem; margin-bottom:1rem;
            background:linear-gradient(135deg,#0f1b2d 0%,#1a2744 100%);
            border-radius:10px;
        ">
            {logo_html}
            <span style="
                color:#ffffff; font-weight:700; font-size:1.15rem;
                letter-spacing:0.5px;
            ">{COMPANY_NAME}</span>
            <span style="
                color:rgba(255,255,255,0.45); font-size:0.85rem;
                margin-left:auto;
            ">Data & Analytics</span>
        </div>
        """,
        unsafe_allow_html=True,
    )
