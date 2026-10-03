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
python3 scripts/shopify-setup.py sync-prices # 59 € Deck-Preise aus CSV → Shopify
python3 scripts/shopify-setup.py all         # Import + Preise + Variant-IDs
```

### Preise (GitHub vs. Shopify)

| Quelle | Deck-Preis |
|--------|------------|
| GitHub Deck Shop / `deck-inventory.js` | **59,00 €** inkl. Griptape (8.38″ & 8.5″) |
| Shopify (Stand vor Sync) | ggf. 89 € / 94 € — aus fehlerhaftem CSV-Import |

**Angleichen:** `shopify/products.csv` enthält für alle 12 Decks **59.00**. Nach Credentials in der Environment:

```bash
python3 scripts/shopify-setup.py sync-prices
```

**Manuell in Admin:** Products → jedes `payday-deck-*` → Preis **59,00** (beide Größen gleich).

---

## Demo-Checkout: Test payment gateway

Keine echten Abbuchungen — **Shopify Payments nicht nötig**.

1. [Zahlungen](https://admin.shopify.com/store/xwk1u9-6z/settings/payments) öffnen  
2. **Shopify Payments** → **Alle anderen Anbieter anzeigen**  
3. **Test payment gateway** aktivieren → **Speichern**  
4. Testkarte im Checkout:
   - Name: **Test payment gateway**
   - Kartennummer: **1**
   - CVV: **111**
   - Ablaufdatum: beliebig in der Zukunft  

Erst wenn **Test payment gateway** gespeichert ist und der **Passwortschutz** aus ist, ist der End-to-End-Test aus dem GitHub Deck Shop sinnvoll.

Ergebnis:

- `deck-shop/config.local.js` — Domain, Variant-IDs für alle 12 Deck-SKUs
- `shop/config.local.js` — Variant-IDs für Ticket/Packs/Print
- `shopify/sync-summary.json` — Report fehlender Produkte

Die Dateien `*.local.js` sind **gitignored** — Secrets bleiben lokal/in deiner Umgebung.

---

## Checkout zeigt „Opening soon“ / Passwortseite

Der Deck Shop leitet korrekt zu Shopify weiter. Wenn dort **Opening soon** oder **Enter store password** erscheint, ist der **Online Store passwortgeschützt** (typisch bei Dev-/Trial-Shops).

**Fix in Shopify Admin (für `xwk1u9-6z.myshopify.com`):**

Direktlink: [Online Store → Preferences](https://admin.shopify.com/store/xwk1u9-6z/online_store/preferences)

1. **Online Store** → **Preferences**
2. Bereich **Password protection** / **Restrict store access**
3. Häkchen **entfernen** bzw. **Remove password** — nicht nur das Passwort ändern, sondern den Schutz **ausschalten**
4. **Save**
5. Test: https://xwk1u9-6z.myshopify.com/ muss **nicht** mehr auf `/password` springen
6. Falls weiterhin gesperrt: **Settings** → **Plan** (Trial/Entwicklungsshop ggf. Plan wählen)

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
