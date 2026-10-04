#!/usr/bin/env python3
"""Shopify CSV: Deck preview + thumb URLs (Import ohne Admin-API)."""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "shopify" / "deck-media.json"
OUT = ROOT / "shopify" / "import" / "deck-media-update.csv"

FIELDNAMES = ["Handle", "Image Src", "Image Position", "Image Alt Text"]

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


def main() -> None:
    media = json.loads(MEDIA.read_text(encoding="utf-8"))
    mapping = media["skuToManifestKey"]
    labels = media.get("manifestLabels") or {}
    base = media["githubPagesAssetBase"].rstrip("/") + "/boards/"

    rows: list[dict[str, str]] = []
    for sku, handle in HANDLES.items():
        mk = mapping[sku]
        label = labels.get(mk, mk)
        rows.append(
            {
                "Handle": handle,
                "Image Src": f"{base}{mk}-preview.jpg",
                "Image Position": "1",
                "Image Alt Text": f"Payday Deck {label} — Produktansicht",
            }
        )
        rows.append(
            {
                "Handle": handle,
                "Image Src": f"{base}{mk}-thumb.jpg",
                "Image Position": "2",
                "Image Alt Text": f"Payday Deck {label} — Thumbnail",
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} image rows ({len(HANDLES)} products) → {OUT}")
    print(
        "Import: https://admin.shopify.com/store/xwk1u9-6z/products?selectedView=all "
        "→ Import → deck-media-update.csv"
    )


if __name__ == "__main__":
    main()
