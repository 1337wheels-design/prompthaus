#!/usr/bin/env python3
"""Open Shopify product import; report login state (Playwright)."""
from pathlib import Path

from playwright.sync_api import sync_playwright

STORE = "xwk1u9-6z"
IMPORT_URL = f"https://admin.shopify.com/store/{STORE}/products/import"
OUT = Path("/opt/cursor/artifacts")
OUT.mkdir(parents=True, exist_ok=True)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.goto(IMPORT_URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(4000)
        url = page.url
        body = page.locator("body").inner_text(timeout=10000)[:2000]
        logged_in = "login" not in url.lower() and "accounts.shopify.com" not in url
        shot = OUT / "shopify-import-page.png"
        page.screenshot(path=str(shot), full_page=False)
        browser.close()

    print(f"URL: {url}")
    print(f"Logged in (heuristic): {logged_in}")
    print(f"Screenshot: {shot}")
    if not logged_in:
        print("→ Bitte im Browser einloggen, dann CSV importieren:")
        print(f"  {Path('shopify/import/deck-media-update.csv').resolve()}")
    else:
        print("→ Import-Seite bereit. CSV hochladen (Update existing products by Handle).")
    if "import" in body.lower() or "csv" in body.lower():
        print("Seite enthält Import/CSV-Hinweise: OK")
    elif not logged_in:
        print("Hinweis: Login-Seite erwartet — Session nicht in Headless-Browser.")


if __name__ == "__main__":
    main()
