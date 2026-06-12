# scripts/capture-landing-shots3.py — pass 3: retake shots WITH PRIVACY MODE
# (mask account ids, names, money) — replaces leaky terminal/flash/grid shots.
# Run: uv run --python 3.12 --with playwright==1.52.0 python scripts/capture-landing-shots3.py

import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "docs"
BASE = "http://localhost:5173"

WS = {
    "blocks": [
        {"id": "watchlist-0", "type": "watchlist", "pin": None},
        {"id": "movers-0", "type": "movers", "pin": None},
        {"id": "chart-0", "type": "chart", "pin": None},
        {"id": "dock-0", "type": "dock", "pin": None},
        {"id": "depth-0", "type": "depth", "pin": None},
        {"id": "ticket-0", "type": "ticket", "pin": None},
        {"id": "tape-0", "type": "tape", "pin": None},
    ],
    "layout": [
        {"i": "watchlist-0", "x": 0, "y": 0, "w": 4, "h": 14, "minW": 3, "minH": 6},
        {"i": "movers-0", "x": 0, "y": 14, "w": 4, "h": 11, "minW": 3, "minH": 5},
        {"i": "chart-0", "x": 4, "y": 0, "w": 15, "h": 16, "minW": 6, "minH": 7},
        {"i": "dock-0", "x": 4, "y": 16, "w": 15, "h": 9, "minW": 6, "minH": 5},
        {"i": "depth-0", "x": 19, "y": 0, "w": 5, "h": 8, "minW": 4, "minH": 7},
        {"i": "ticket-0", "x": 19, "y": 8, "w": 5, "h": 11, "minW": 4, "minH": 10},
        {"i": "tape-0", "x": 19, "y": 19, "w": 5, "h": 6, "minW": 3, "minH": 4},
    ],
}

CLIMB_JS = """
(el) => {
  let n = el;
  while (n && n.parentElement) {
    const r = n.getBoundingClientRect();
    if (r.height > 260 && r.width > 300) return n;
    n = n.parentElement;
  }
  return el;
}
"""


def panel_shot(page, title, fname, settle=2.0):
    loc = page.get_by_text(title, exact=False).first
    handle = loc.element_handle()
    root = handle.evaluate_handle(CLIMB_JS)
    el = root.as_element()
    el.scroll_into_view_if_needed()
    time.sleep(settle)
    el.screenshot(path=str(OUT / fname))
    print("saved", fname)


def add_panel(page, name):
    page.get_by_role("button", name="＋ 新增面板").click()
    time.sleep(0.4)
    page.locator("button", has_text=name).last.click()
    time.sleep(0.8)


def seed(page, mode):
    page.goto(BASE)
    page.evaluate(
        """([ws, mode]) => {
            localStorage.setItem('sj-pro-workspace-v2', ws);
            localStorage.setItem('sj-pro-watchlist-spark', '1');
            localStorage.setItem('sj-pro-privacy-mode', '1');
            localStorage.setItem('sj-pro-privacy-money', '1');
            localStorage.setItem('sj-pro-theme', JSON.stringify({mode, convention:'tw', fontScale:1}));
        }""",
        [json.dumps(WS), mode],
    )
    page.reload()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=2,
            color_scheme="dark",
            locale="zh-TW",
            timezone_id="Asia/Taipei",
        )
        page = ctx.new_page()
        seed(page, "dark")
        print("waiting for live data...")
        time.sleep(18)
        page.screenshot(path=str(OUT / "shot-terminal-dark.png"))
        print("saved shot-terminal-dark.png")

        try:
            page.get_by_text("TXFR1", exact=True).first.click()
            time.sleep(2)
        except Exception as e:
            print("link TXFR1 failed:", e)

        try:
            add_panel(page, "閃電下單")
            time.sleep(1)
            en = page.get_by_role("button", name="啟用閃電下單")
            if en.count() > 0:
                en.first.click()
                time.sleep(2)
            panel_shot(page, "閃電下單", "shot-flash.png", settle=3)
        except Exception as e:
            print("flash failed:", e)

        try:
            add_panel(page, "鋪單")
            time.sleep(1)
            panel_shot(page, "鋪單", "shot-grid.png")
        except Exception as e:
            print("grid failed:", e)

        ctx.close()

        ctx2 = browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=2,
            color_scheme="light",
            locale="zh-TW",
            timezone_id="Asia/Taipei",
        )
        page2 = ctx2.new_page()
        seed(page2, "light")
        time.sleep(16)
        page2.screenshot(path=str(OUT / "shot-terminal-light.png"))
        print("saved shot-terminal-light.png")
        ctx2.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
