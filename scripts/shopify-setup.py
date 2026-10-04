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
  python3 scripts/shopify-setup.py sync-images   # Deck thumb + preview → Shopify-Produkte
  python3 scripts/shopify-setup.py verify-deck-assets  # Lokale JPGs vs. deck-media.json
  python3 scripts/shopify-setup.py all
"""
from __future__ import annotations

import base64
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
DECK_MEDIA_PATH = ROOT / "shopify" / "deck-media.json"
BOARDS_DIR = ROOT / "deck-shop" / "assets" / "boards"
ASSETS_DIR = ROOT / "deck-shop" / "assets"
API_VERSION = "2024-10"
ASSET_ALT_PREFIX = "payday-asset:"

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


def load_deck_media() -> dict:
    if not DECK_MEDIA_PATH.is_file():
        sys.exit(f"Fehlt: {DECK_MEDIA_PATH}")
    return json.loads(DECK_MEDIA_PATH.read_text(encoding="utf-8"))


def manifest_key_for_sku(sku: str, media: dict | None = None) -> str:
    media = media or load_deck_media()
    mapping = media.get("skuToManifestKey") or {}
    key = mapping.get(sku)
    if not key:
        raise KeyError(f"Kein Manifest für SKU {sku!r} in deck-media.json")
    return str(key)


def asset_alt(manifest_key: str, role_id: str) -> str:
    return f"{ASSET_ALT_PREFIX}{manifest_key}:{role_id}"


def github_pages_asset_url(relative_path: str, media: dict | None = None) -> str:
    media = media or load_deck_media()
    base = (env("PAYDAY_GITHUB_PAGES_ASSET_BASE") or media.get("githubPagesAssetBase") or "").strip()
    if not base.endswith("/"):
        base += "/"
    rel = relative_path.lstrip("/")
    if rel.startswith("boards/"):
        return base + rel
    return base + "boards/" + rel


def deck_image_entries(manifest_key: str, media: dict | None = None) -> list[dict]:
    """Preview + thumb wie im Deck Shop (Reihenfolge: Hero, dann Thumbnail)."""
    media = media or load_deck_media()
    labels = media.get("manifestLabels") or {}
    label = labels.get(manifest_key, manifest_key)
    roles = media.get("roles") or [
        {"id": "preview", "suffix": "-preview.jpg", "position": 1, "altSuffix": "— Produktansicht"},
        {"id": "thumb", "suffix": "-thumb.jpg", "position": 2, "altSuffix": "— Thumbnail"},
    ]
    entries = []
    for role in roles:
        filename = f"{manifest_key}{role['suffix']}"
        rel = f"boards/{filename}"
        entries.append(
            {
                "role": role["id"],
                "filename": filename,
                "relative": rel,
                "local_path": ASSETS_DIR / rel,
                "position": int(role.get("position") or 1),
                "alt": f"Payday Deck {label} {role.get('altSuffix', '').strip()}".strip(),
                "alt_key": asset_alt(manifest_key, role["id"]),
                "src": github_pages_asset_url(rel, media),
            }
        )
    return entries


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


def list_product_images(domain: str, token: str, product_id: int) -> list:
    data = admin_request(domain, token, "GET", f"/products/{product_id}/images.json")
    return data.get("images") or []


def delete_product_image(domain: str, token: str, product_id: int, image_id: int) -> None:
    admin_request(domain, token, "DELETE", f"/products/{product_id}/images/{image_id}.json")


def image_entry_present(existing: list, entry: dict) -> bool:
    for img in existing:
        alt = str(img.get("alt") or "")
        if entry["alt_key"] == alt or entry["alt_key"] in alt:
            return True
        src = str(img.get("src") or "")
        if entry["filename"] in src:
            return True
    return False


def upload_product_image(
    domain: str,
    token: str,
    product_id: int,
    entry: dict,
    *,
    prefer_local: bool = True,
) -> dict:
    path: Path = entry["local_path"]
    body: dict = {
        "filename": entry["filename"],
        "alt": f"{entry['alt']} [{entry['alt_key']}]",
        "position": entry["position"],
    }
    if prefer_local and path.is_file():
        body["attachment"] = base64.b64encode(path.read_bytes()).decode("ascii")
    else:
        body["src"] = entry["src"]
    data = admin_request(
        domain,
        token,
        "POST",
        f"/products/{product_id}/images.json",
        {"image": body},
    )
    return data["image"]


def sync_images_for_handle(
    domain: str,
    token: str,
    handle: str,
    sku: str,
    *,
    replace: bool = False,
    dry_run: bool = False,
) -> tuple[int, int]:
    media = load_deck_media()
    manifest_key = manifest_key_for_sku(sku, media)
    product = get_product_by_handle(domain, token, handle)
    if not product:
        print(f"  fehlt Produkt: {handle}")
        return 0, 0
    pid = int(product["id"])
    planned = deck_image_entries(manifest_key, media)
    existing = list_product_images(domain, token, pid)

    added = 0
    skipped = 0

    if replace:
        for img in existing:
            alt = str(img.get("alt") or "")
            src = str(img.get("src") or "")
            tagged = ASSET_ALT_PREFIX in alt or any(p["filename"] in src for p in planned)
            if tagged and not dry_run:
                delete_product_image(domain, token, pid, int(img["id"]))

    if replace and not dry_run:
        existing = list_product_images(domain, token, pid)

    for entry in planned:
        if not entry["local_path"].is_file():
            print(f"  WARN lokale Datei fehlt: {entry['local_path']} (fallback URL)")
        if image_entry_present(existing, entry):
            skipped += 1
            continue
        if dry_run:
            print(f"  würde hochladen: {handle} ← {entry['filename']} (pos {entry['position']})")
            added += 1
            continue
        upload_product_image(domain, token, pid, entry)
        print(f"  + {handle}: {entry['filename']}")
        added += 1

    return added, skipped


def cmd_sync_images(domain: str, token: str):
    replace = "--replace" in sys.argv
    dry_run = "--dry-run" in sys.argv
    print("Deck-Bilder (preview + thumb) an Shopify-Produkte anbinden")
    print(f"  Quelle: {BOARDS_DIR}")
    if dry_run:
        print("  Modus: dry-run (keine Uploads)")
    if replace:
        print("  Modus: --replace (bestehende payday-asset:* Bilder ersetzen)")

    total_add = 0
    total_skip = 0
    for sku, handle in DECK_SKU_HANDLE.items():
        a, s = sync_images_for_handle(
            domain, token, handle, sku, replace=replace, dry_run=dry_run
        )
        total_add += a
        total_skip += s
    print(f"  fertig: {total_add} neu, {total_skip} bereits vorhanden ({len(DECK_SKU_HANDLE)} Produkte)")


def cmd_verify_deck_assets():
    media = load_deck_media()
    print("Deck-Asset-Check (lokal, wie Deck Shop)")
    missing = []
    for sku, handle in DECK_SKU_HANDLE.items():
        manifest_key = manifest_key_for_sku(sku, media)
        for entry in deck_image_entries(manifest_key, media):
            ok = entry["local_path"].is_file()
            mark = "✓" if ok else "✗"
            print(f"  {mark} {handle} → {entry['filename']}")
            if not ok:
                missing.append(str(entry["local_path"]))
    if missing:
        print(f"  FEHLER: {len(missing)} Dateien fehlen — ggf. scripts/extract-board-assets.py ausführen")
        sys.exit(1)
    print("  Alle 12×2 Bildreferenzen vorhanden (6 Designs × 2 Größen × 2 Dateien)")


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
    if cmd == "verify-deck-assets":
        cmd_verify_deck_assets()
        return
    domain, token = require_env()
    if cmd == "import-products":
        cmd_import_products(domain, token)
    elif cmd == "sync-config":
        ok = cmd_sync_config(domain, token)
        sys.exit(0 if ok else 2)
    elif cmd == "sync-prices":
        cmd_sync_prices(domain, token)
    elif cmd == "sync-images":
        cmd_sync_images(domain, token)
    elif cmd == "all":
        cmd_import_products(domain, token)
        cmd_sync_prices(domain, token)
        cmd_sync_images(domain, token)
        ok = cmd_sync_config(domain, token)
        sys.exit(0 if ok else 2)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
