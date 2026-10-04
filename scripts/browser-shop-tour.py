#!/usr/bin/env python3
"""Step-by-step shop walkthrough — screenshots + optional video."""
import re
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path("/tmp/shop-tour-screenshots")
OUT.mkdir(parents=True, exist_ok=True)
VIDEO_DIR = Path("/tmp")
BASE = "https://1337wheels-design.github.io/prompthaus"


def snap(page, name, note=""):
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    print(f"OK {name}: {note}")
    return path


def pause(page, seconds=2):
    page.wait_for_timeout(int(seconds * 1000))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1400, "height": 900},
        record_video_dir=str(VIDEO_DIR),
        record_video_size={"width": 1400, "height": 900},
    )
    page = context.new_page()

    # STEP 1 — Event landing
    page.goto(f"{BASE}/shop/", wait_until="networkidle", timeout=60000)
    pause(page, 1.5)
    snap(page, "01-event-hero", "Event-Seite Hero")

    # STEP 2 — Shop section
    page.goto(f"{BASE}/shop/#shop", wait_until="networkidle")
    pause(page, 2)
    snap(page, "02-shop-products", "Produkt-Grid #shop")

    # STEP 3 — Konfigurieren
    konf = page.get_by_role("link", name=re.compile("Konfigurieren", re.I))
    if konf.count():
        with page.expect_navigation(wait_until="networkidle"):
            konf.first.click()
        pause(page, 3)
        snap(page, "03-deck-shop-loaded", "Deck Shop nach Konfigurieren")
    else:
        page.goto(f"{BASE}/deck-shop/", wait_until="networkidle")
        snap(page, "03-deck-shop-direct", "Deck Shop direkt")

    # STEP 4 — Intro abwarten, dann 3× Weiter (Desktop)
    page.wait_for_function(
        "() => { const b = document.getElementById('phase-badge'); return b && /SCHRITT/i.test(b.textContent); }",
        timeout=60000,
    )
    pause(page, 1)
    snap(page, "04-intro-or-progress", "Swipe-Phase bereit")
    for _ in range(3):
        page.evaluate("document.getElementById('nav-next').click()")
        pause(page, 1.4)
    page.locator("#shop-section.is-unlocked").wait_for(state="attached", timeout=15000)
    pause(page, 1)
    snap(page, "05-after-swipes", "Shop freigeschaltet")

    # STEP 5 — Warenkorb
    page.locator("#shop-section").scroll_into_view_if_needed()
    pause(page, 0.8)
    add = page.locator(".deck-card__add:not([disabled])").first
    if add.count() and add.is_visible():
        add.click()
        pause(page, 1.5)
        snap(page, "06-cart-added", "Deck im Warenkorb")
    else:
        snap(page, "06-no-add-btn", "Kein Add-Button sichtbar — ggf. noch gesperrt")

    page.once("dialog", lambda d: d.accept())
    checkout = page.locator("#checkout-btn")
    if checkout.is_visible():
        checkout.click()
        pause(page, 1)
    snap(page, "07-after-checkout", "Nach Zur Kasse (Alert geschlossen)")

    # STEP 6 — Event shop Kaufen
    page.goto(f"{BASE}/shop/#shop", wait_until="networkidle")
    pause(page, 1)
    kaufen = page.get_by_role("button", name=re.compile("^Kaufen$", re.I)).first
    if kaufen.count():
        kaufen.click()
        pause(page, 1.5)
    snap(page, "08-pack-kaufen-notice", "Single Pack → Shopify-Hinweis")

    # STEP 7 — Config on GitHub
    page.goto(
        "https://github.com/1337wheels-design/prompthaus/blob/gh-pages/deck-shop/config.js",
        wait_until="domcontentloaded",
        timeout=60000,
    )
    pause(page, 2)
    page.evaluate("window.scrollTo(0, 400)")
    pause(page, 1)
    snap(page, "09-github-config", "deck-shop/config.js")

    # STEP 8 — products.csv
    page.goto(
        "https://github.com/1337wheels-design/prompthaus/blob/gh-pages/shopify/products.csv",
        wait_until="domcontentloaded",
    )
    pause(page, 2)
    snap(page, "10-github-csv", "shopify/products.csv")

    video_path = page.video.path() if page.video else None
    context.close()
    browser.close()

    if video_path:
        dest = VIDEO_DIR / "shop-tour-walkthrough.mp4"
        Path(video_path).rename(dest)
        print(f"VIDEO {dest}")

print("DONE", OUT)
