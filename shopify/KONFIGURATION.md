# Shopify Shop — Konfiguration (Hybrid C)

Diese Checkliste übernimmt der Agent **automatisch** via `scripts/shopify-setup.py`, sobald die Zugangsdaten in der Cloud-Umgebung liegen.

## Was du einmalig in Cursor hinterlegen musst

Cloud Agent → **Environment** → Secrets / Variables:

| Variable | Beispiel | Wo in Shopify |
|----------|----------|----------------|
| `SHOPIFY_STORE_DOMAIN` | `payday-uepark.myshopify.com` | Settings → Domains |
| `SHOPIFY_CLIENT_ID` | aus Dev Dashboard | App → Settings |
| `SHOPIFY_CLIENT_SECRET` | aus Dev Dashboard | App → Settings (Secret!) |
| `SHOPIFY_STOREFRONT_TOKEN` | Public token | App installiert / Headless (Deck-Checkout) |
| `SHOPIFY_ADMIN_TOKEN` | `shpat_…` | nur Legacy Custom Apps (optional) |

**Admin API Scopes (Minimum):** `read_products`, `write_products` (nur für automatischen Import)

**Storefront Scopes (empfohlen):** `unauthenticated_read_product_listings`, Cart/Checkout

---

## Was der Agent dann ausführt (ohne Browser-Tour)

```bash
python3 scripts/shopify-setup.py status      # Verbindung prüfen
python3 scripts/shopify-setup.py all         # Import + Variant-IDs → config.local.js
```

Ergebnis:

- `deck-shop/config.local.js` — Domain, Variant-IDs für alle 12 Deck-SKUs
- `shop/config.local.js` — Variant-IDs für Ticket/Packs/Print
- `shopify/sync-summary.json` — Report fehlender Produkte

Die Dateien `*.local.js` sind **gitignored** — Secrets bleiben lokal/in deiner Umgebung.

---

## Checkout zeigt „Opening soon“ / Passwortseite

Der Deck Shop leitet korrekt zu Shopify weiter. Wenn dort **Opening soon** oder **Enter store password** erscheint, ist der **Online Store passwortgeschützt** (typisch bei Dev-/Trial-Shops).

**Fix in Shopify Admin:**

1. **Online Store** → **Preferences** (oder **Settings** → **Apps and sales channels** → **Online Store** → **Open sales channel** → **Preferences**)
2. Bereich **Password protection** / **Store access**
3. **Passwortschutz deaktivieren** bzw. **Remove password** / Shop veröffentlichen
4. Optional: **Settings** → **Plan** — Trial-Shop braucht ggf. einen Plan, damit Käufer-Checkout dauerhaft offen ist

Headless/Storefront-API funktioniert trotzdem; **Browser-Checkout** (`/cart/…`, `checkoutUrl`) landet solange auf `/password`.

---

## Manuelle Alternative (wenn du keinen Admin-Token geben willst)

1. Admin → **Products → Import** → `shopify/products.csv`
2. Im Deck Shop (GitHub Pages): **Shopify**-Button → Domain + Storefront-Token → **Varianten laden**

---

## Architektur (aktuell deployed)

- Event + Shop: `https://1337wheels-design.github.io/prompthaus/shop/`
- Deck Konfigurator: `https://1337wheels-design.github.io/prompthaus/deck-shop/`
- Checkout: Shopify gehostet (Hybrid)
