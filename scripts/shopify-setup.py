#!/usr/bin/env python3
"""
Payday — Shopify-Konfiguration (Admin API)
Benötigt Umgebungsvariablen:
  SHOPIFY_STORE_DOMAIN   z.B. payday-uepark.myshopify.com
  SHOPIFY_ADMIN_TOKEN       Admin API token (shpat_…, legacy)
  — oder Dev Dashboard —
  SHOPIFY_CLIENT_ID         Client ID
  SHOPIFY_CLIENT_SECRET     Client secret (Client-Credentials, ~24h Token)
Optional:
  SHOPIFY_STOREFRONT_TOKEN  Storefront public token → config.local.js

Aufruf:
  python3 scripts/shopify-setup.py status
  python3 scripts/shopify-setup.py import-products
  python3 scripts/shopify-setup.py sync-config
  python3 scripts/shopify-setup.py sync-prices   # Preise aus CSV → bestehende Varianten
  python3 scripts/shopify-setup.py all
"""
from __future__ import annotations

import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "shopify" / "products.csv"
API_VERSION = "2024-10"

# deck-inventory SKU → Shopify handle (must match products.csv)
DECK_SKU_HANDLE = {
    "chrome-838": "payday-deck-chrome-838",
    "chrome-850": "payday-deck-chrome-850",
    "neon-838": "payday-deck-neon-838",
    "neon-850": "payday-deck-neon-850",
    "payday-linear-838": "payday-deck-linear-838",
    "payday-linear-850": "payday-deck-linear-850",
    "arctic-838": "payday-deck-arctic-838",
    "arctic-850": "payday-deck-arctic-850",
    "night-838": "payday-deck-night-838",
    "night-850": "payday-deck-night-850",
    "payday-camo-838": "payday-deck-camo-838",
    "payday-camo-850": "payday-deck-camo-850",
}

PACK_HANDLES = [
    "event-ticket",
    "single-pack",
    "double-pack",
    "triple-pack",
    "art-print-attitude",
]


def env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def client_credentials_token(domain: str, client_id: str, client_secret: str) -> str:
    url = f"https://{domain}/admin/oauth/access_token"
    body = (
        f"grant_type=client_credentials&client_id={urllib.parse.quote(client_id)}"
        f"&client_secret={urllib.parse.quote(client_secret)}"
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Client credentials failed HTTP {e.code}: {payload}") from e
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"Kein access_token in Antwort: {data}")
    return str(token)


def resolve_admin_token(domain: str) -> str:
    direct = env("SHOPIFY_ADMIN_TOKEN")
    if direct:
        return direct
    client_id = env("SHOPIFY_CLIENT_ID")
    client_secret = env("SHOPIFY_CLIENT_SECRET")
    if client_id and client_secret:
        print("  Admin-Token via Client Credentials (Dev Dashboard)…")
        return client_credentials_token(domain, client_id, client_secret)
    sys.exit(
        "Kein Admin-Zugang: SHOPIFY_ADMIN_TOKEN oder "
        "SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET in der Environment setzen."
    )


def require_env() -> tuple[str, str]:
    domain = env("SHOPIFY_STORE_DOMAIN").replace("https://", "").replace("http://", "").strip("/")
    if not domain or "YOUR-STORE" in domain:
        sys.exit(
            "SHOPIFY_STORE_DOMAIN fehlt. In Cursor: Cloud Agent Environment → "
            "SHOPIFY_STORE_DOMAIN=dein-store.myshopify.com"
        )
    token = resolve_admin_token(domain)
    return domain, token


def admin_request(domain: str, token: str, method: str, path: str, body: dict | None = None):
    url = f"https://{domain}/admin/api/{API_VERSION}{path}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Shopify HTTP {e.code} {path}: {payload}") from e


def get_product_by_handle(domain: str, token: str, handle: str) -> dict | None:
    data = admin_request(domain, token, "GET", f"/products.json?handle={handle}&limit=1")
    products = data.get("products") or []
    return products[0] if products else None


def create_product_from_row(domain: str, token: str, row: dict) -> dict:
    handle = row["Handle"]
    existing = get_product_by_handle(domain, token, handle)
    if existing:
        print(f"  skip (exists): {handle}")
        return existing

    tags = row.get("Tags", "")
    variant = {
        "option1": row.get("Option1 Value") or "Default Title",
        "price": row.get("Variant Price", "0"),
        "sku": row.get("Variant SKU", ""),
        "grams": int(float(row.get("Variant Grams") or 0)),
        "inventory_management": "shopify" if row.get("Variant Inventory Tracker") == "shopify" else None,
        "inventory_quantity": int(float(row.get("Variant Inventory Qty") or 0)),
        "requires_shipping": row.get("Variant Requires Shipping", "true").lower() == "true",
        "taxable": row.get("Variant Taxable", "true").lower() == "true",
    }
    if row.get("Option1 Name") and row["Option1 Name"] != "Title":
        product = {
            "title": row["Title"],
            "body_html": row.get("Body (HTML)", ""),
            "vendor": row.get("Vendor", ""),
            "product_type": row.get("Type", ""),
            "tags": tags,
            "handle": handle,
            "published": row.get("Published", "true").lower() == "true",
            "options": [{"name": row["Option1 Name"]}],
            "variants": [variant],
        }
    else:
        product = {
            "title": row["Title"],
            "body_html": row.get("Body (HTML)", ""),
            "vendor": row.get("Vendor", ""),
            "product_type": row.get("Type", ""),
            "tags": tags,
            "handle": handle,
            "published": row.get("Published", "true").lower() == "true",
            "variants": [{"price": variant["price"], "sku": variant["sku"], **variant}],
        }

    print(f"  create: {handle}")
    data = admin_request(domain, token, "POST", "/products.json", {"product": product})
    return data["product"]


def cmd_import_products(domain: str, token: str):
    print("Schritt 1/3 — Produkte aus CSV anlegen (falls fehlend)")
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        create_product_from_row(domain, token, row)
    print(f"  fertig ({len(rows)} CSV-Zeilen geprüft)")


def fetch_variant_id(domain: str, token: str, handle: str) -> str | None:
    p = get_product_by_handle(domain, token, handle)
    if not p:
        return None
    variants = p.get("variants") or []
    if not variants:
        return None
    return str(variants[0]["id"])


def update_variant_price(domain: str, token: str, handle: str, price: str) -> bool:
    p = get_product_by_handle(domain, token, handle)
    if not p:
        print(f"  fehlt: {handle}")
        return False
    variants = p.get("variants") or []
    if not variants:
        print(f"  keine Variante: {handle}")
        return False
    vid = variants[0]["id"]
    admin_request(
        domain,
        token,
        "PUT",
        f"/variants/{vid}.json",
        {"variant": {"id": vid, "price": str(price)}},
    )
    print(f"  {handle} → {price} EUR")
    return True


def cmd_sync_prices(domain: str, token: str):
    print("Preise aus CSV in Shopify aktualisieren (bestehende Produkte)")
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    ok = 0
    for row in rows:
        handle = row.get("Handle", "").strip()
        price = row.get("Variant Price", "").strip()
        if not handle or not price:
            continue
        if update_variant_price(domain, token, handle, price):
            ok += 1
    print(f"  fertig: {ok}/{len(rows)} Zeilen")


def cmd_sync_config(domain: str, token: str):
    print("Schritt 2/3 — Variant-IDs vom Shop lesen")
    deck_variants = {}
    missing = []
    for sku, handle in DECK_SKU_HANDLE.items():
        vid = fetch_variant_id(domain, token, handle)
        deck_variants[sku] = {"handle": handle, "variantId": int(vid) if vid else None}
        if not vid:
            missing.append(handle)
        else:
            print(f"  {sku} → {vid}")

    pack_variants = {}
    for handle in PACK_HANDLES:
        vid = fetch_variant_id(domain, token, handle)
        pack_variants[handle] = {"handle": handle, "variantId": int(vid) if vid else None}
        if not vid:
            missing.append(handle)

    if missing:
        print("  WARNUNG — fehlende Handles:", ", ".join(missing))

    storefront = env("SHOPIFY_STOREFRONT_TOKEN")
    print("Schritt 3/3 — config.local.js schreiben (gitignored)")

    deck_lines = [
        "/** Auto-generated by scripts/shopify-setup.py — nicht committen */",
        "Object.assign(window.PAYDAY_SHOP = window.PAYDAY_SHOP || {}, {",
        f"  shopDomain: '{domain}',",
    ]
    if storefront:
        deck_lines.append(f"  storefrontAccessToken: '{storefront}',")
    deck_lines.append("  deckVariants: {")
    for sku, entry in deck_variants.items():
        vid = "null" if entry["variantId"] is None else entry["variantId"]
        deck_lines.append(f"    '{sku}': {{ handle: '{entry['handle']}', variantId: {vid} }},")
    deck_lines.append("  },")
    deck_lines.append("});")

    deck_path = ROOT / "deck-shop" / "config.local.js"
    deck_path.write_text("\n".join(deck_lines) + "\n", encoding="utf-8")
    print(f"  → {deck_path}")

    shop_products = []
    shop_cfg_path = ROOT / "shop" / "config.js"
    # Minimal pack mapping for shop/config.local.js
    shop_lines = [
        "/** Auto-generated — shop packs variantId */",
        "(function () {",
        "  const base = window.PAYDAY_SHOP || {};",
        "  base.shopDomain = '" + domain + "';",
        "  if (!base.products) return;",
        "  const ids = " + json.dumps({h: pack_variants[h]["variantId"] for h in PACK_HANDLES}) + ";",
        "  base.products = base.products.map((p) => ({",
        "    ...p,",
        "    variantId: ids[p.handle] ?? p.variantId,",
        "  }));",
        "  window.PAYDAY_SHOP = base;",
        "})();",
    ]
    shop_local = ROOT / "shop" / "config.local.js"
    shop_local.write_text("\n".join(shop_lines) + "\n", encoding="utf-8")
    print(f"  → {shop_local}")

    summary = ROOT / "shopify" / "sync-summary.json"
    summary.write_text(
        json.dumps(
            {"shopDomain": domain, "deckVariants": deck_variants, "packVariants": pack_variants, "missing": missing},
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"  → {summary}")
    return len(missing) == 0


def cmd_status():
    domain = env("SHOPIFY_STORE_DOMAIN")
    token = env("SHOPIFY_ADMIN_TOKEN")
    cid = env("SHOPIFY_CLIENT_ID")
    secret = env("SHOPIFY_CLIENT_SECRET")
    sf = env("SHOPIFY_STOREFRONT_TOKEN")
    print("Shopify Setup Status")
    print(f"  SHOPIFY_STORE_DOMAIN:     {'✓ ' + domain if domain else '✗ fehlt'}")
    print(f"  SHOPIFY_ADMIN_TOKEN:      {'✓ gesetzt' if token else '○ (optional)'}")
    print(f"  SHOPIFY_CLIENT_ID:        {'✓ gesetzt' if cid else '✗ fehlt'}")
    print(f"  SHOPIFY_CLIENT_SECRET:    {'✓ gesetzt' if secret else '✗ fehlt'}")
    print(f"  SHOPIFY_STOREFRONT_TOKEN: {'✓ gesetzt' if sf else '○ für Deck-Checkout empfohlen'}")
    print(f"  CSV: {CSV_PATH} ({CSV_PATH.exists()})")
    if domain and (token or (cid and secret)):
        try:
            d = domain.replace("https://", "").strip("/")
            api_token = resolve_admin_token(d)
            data = admin_request(d, api_token, "GET", "/shop.json")
            print(f"  Shop-Name: {data.get('shop', {}).get('name', '?')}")
            print("  API-Test: OK")
        except Exception as e:
            print(f"  API-Test fehlgeschlagen: {e}")


def main():
    cmd = (sys.argv[1] if len(sys.argv) > 1 else "status").lower()
    if cmd == "status":
        cmd_status()
        return
    domain, token = require_env()
    if cmd == "import-products":
        cmd_import_products(domain, token)
    elif cmd == "sync-config":
        ok = cmd_sync_config(domain, token)
        sys.exit(0 if ok else 2)
    elif cmd == "sync-prices":
        cmd_sync_prices(domain, token)
    elif cmd == "all":
        cmd_import_products(domain, token)
        cmd_sync_prices(domain, token)
        ok = cmd_sync_config(domain, token)
        sys.exit(0 if ok else 2)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
