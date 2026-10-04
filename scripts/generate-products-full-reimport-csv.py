#!/usr/bin/env python3
"""
Vollständige Shopify-Produkt-CSV (Reimport).

- Alle Produkte aus shopify/products.csv
- Moderne Spalten (URL handle, Product image URL, …)
- Decks: Hauptzeile + Bildzeile (nur Handle + zweites Bild), Shopify-konform
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "shopify" / "products.csv"
MEDIA = ROOT / "shopify" / "deck-media.json"
OUT = ROOT / "shopify" / "import" / "products-full-reimport.csv"

# Shopify product CSV (2024+ — siehe Help Center „Description of the columns“)
HEADERS = [
    "Title",
    "URL handle",
    "Description",
    "Vendor",
    "Type",
    "Tags",
    "Published on online store",
    "Status",
    "Option1 name",
    "Option1 value",
    "SKU",
    "Weight value (grams)",
    "Inventory tracker",
    "Inventory quantity",
    "Continue selling when out of stock",
    "Price",
    "Requires shipping",
    "Charge tax",
    "Fulfillment service",
    "Product image URL",
    "Image position",
    "Image alt text",
    "SEO title",
    "SEO description",
]

HANDLES = {
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


def empty_row() -> dict[str, str]:
    return {h: "" for h in HEADERS}


def deck_images_for_handle(handle: str, media: dict) -> tuple[str, str, str, str]:
    mapping = media["skuToManifestKey"]
    labels = media.get("manifestLabels") or {}
    base = media["githubPagesAssetBase"].rstrip("/") + "/boards/"
    sku = next(k for k, h in HANDLES.items() if h == handle)
    mk = mapping[sku]
    label = labels.get(mk, mk)
    preview = f"{base}{mk}-preview.jpg"
    thumb = f"{base}{mk}-thumb.jpg"
    alt1 = f"Payday Deck {label} — Produktansicht"
    alt2 = f"Payday Deck {label} — Detail"
    return preview, thumb, alt1, alt2


def legacy_to_row(old: dict[str, str], media: dict | None) -> dict[str, str]:
    row = empty_row()
    handle = old["Handle"].strip()
    row["Title"] = old["Title"]
    row["URL handle"] = handle
    row["Description"] = old.get("Body (HTML)", "")
    row["Vendor"] = old.get("Vendor", "")
    row["Type"] = old.get("Type", "")
    row["Tags"] = old.get("Tags", "")
    row["Published on online store"] = old.get("Published", "true")
    row["Status"] = "active"
    row["Option1 name"] = old.get("Option1 Name", "Title")
    row["Option1 value"] = old.get("Option1 Value", "Default Title")
    row["SKU"] = old.get("Variant SKU", "")
    row["Weight value (grams)"] = old.get("Variant Grams", "0")
    row["Inventory tracker"] = old.get("Variant Inventory Tracker", "shopify")
    row["Inventory quantity"] = old.get("Variant Inventory Qty", "0")
    row["Continue selling when out of stock"] = "deny"
    row["Price"] = old.get("Variant Price", "0")
    row["Requires shipping"] = old.get("Variant Requires Shipping", "true")
    row["Charge tax"] = old.get("Variant Taxable", "true")
    row["Fulfillment service"] = "manual"
    row["SEO title"] = old.get("SEO Title", "")
    row["SEO description"] = old.get("SEO Description", "")

    img = old.get("Image Src", "").strip()
    if handle.startswith("payday-deck-") and media:
        preview, _thumb, alt1, _alt2 = deck_images_for_handle(handle, media)
        row["Product image URL"] = preview or img
        row["Image position"] = "1"
        row["Image alt text"] = alt1
    elif img:
        row["Product image URL"] = img
        row["Image position"] = "1"
    return row


def image_only_row(handle: str, image_url: str, alt: str) -> dict[str, str]:
    """Zusatzbild: laut Shopify nur URL handle + Product image URL (rest leer)."""
    row = empty_row()
    row["URL handle"] = handle
    row["Product image URL"] = image_url
    row["Image alt text"] = alt
    return row


def main() -> None:
    media = json.loads(MEDIA.read_text(encoding="utf-8"))
    old_rows = list(csv.DictReader(SRC.open(encoding="utf-8")))
    out_rows: list[dict[str, str]] = []

    for old in old_rows:
        handle = old["Handle"].strip()
        out_rows.append(legacy_to_row(old, media))
        if handle.startswith("payday-deck-"):
            _preview, thumb, _alt1, alt2 = deck_images_for_handle(handle, media)
            out_rows.append(image_only_row(handle, thumb, alt2))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=HEADERS, lineterminator="\n")
        w.writeheader()
        w.writerows(out_rows)

    products = len(old_rows)
    images_extra = sum(1 for r in old_rows if r["Handle"].startswith("payday-deck-"))
    print(f"Wrote {len(out_rows)} rows ({products} products, {images_extra} extra image rows)")
    print(f"→ {OUT}")
    print("Import: Products → Import → „Overwrite products with matching handles“ (Update)")


if __name__ == "__main__":
    main()
