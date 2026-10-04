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
python3 scripts/shopify-setup.py sync-images # thumb + preview je Deck (wie GitHub Deck Shop)
python3 scripts/shopify-setup.py verify-deck-assets  # nur lokal: JPGs vorhanden?
python3 scripts/shopify-setup.py all         # Import + Preise + Bilder + Variant-IDs
```

### Produktbilder (Decks)

Im [Deck Shop](https://1337wheels-design.github.io/prompthaus/deck-shop/) nutzt jedes Design **zwei** Dateien unter `deck-shop/assets/boards/`:

| Rolle | Datei | Shopify-Position |
|-------|--------|------------------|
| Produktansicht | `{manifest}-preview.jpg` | 1 (Featured) |
| Grid-Thumbnail | `{manifest}-thumb.jpg` | 2 |

Zuordnung SKU → Grafik (identisch zu `deck-inventory.js`): siehe `shopify/deck-media.json`.  
8.38″ und 8.5″ teilen **dieselben** Bilder (nur Größen-Variante unterscheidet sich).

```bash
python3 scripts/shopify-setup.py verify-deck-assets   # 24 JPG-Referenzen lokal prüfen
python3 scripts/shopify-setup.py sync-images          # fehlende Bilder in Admin hochladen
python3 scripts/shopify-setup.py sync-images --dry-run
python3 scripts/shopify-setup.py sync-images --replace  # payday-asset:* neu setzen
```

Upload bevorzugt **lokale JPGs** (Base64); falls eine Datei fehlt, wird die **GitHub-Pages-URL** aus `deck-media.json` als `src` verwendet. Bilder sind idempotent über Alt-Tag `payday-asset:{manifest}:preview|thumb`.

Grafiken aus PDFs neu erzeugen: `python3 scripts/extract-board-assets.py` (benötigt PyMuPDF + Pillow).

### Ohne API-Token: CSV-Reimport (vollständig)

**Nicht** `deck-media-update.csv` allein verwenden — dort steht jeder Handle **zweimal** ohne Produktdaten → Fehler *„handle can only be used once“*.

Stattdessen:

```bash
python3 scripts/shopify-setup.py export-products-full-csv
```

Erzeugt `shopify/import/products-full-reimport.csv`:

- **17 Hauptzeilen** (Ticket, Packs, 12 Decks, Art Print) mit allen Pflichtfeldern
- **12 Zusatzbild-Zeilen** (nur `URL handle` + `Product image URL` + Alt-Text) für das zweite Deck-Bild
- Spalten nach aktuellem Shopify-Format (`URL handle`, `Product image URL`, …)

Import:

1. [Products → Import](https://admin.shopify.com/store/xwk1u9-6z/products/import)
2. `products-full-reimport.csv` hochladen
3. **Overwrite products with matching handles** aktivieren (Update, kein Duplikat-Anlegen)
4. Danach: `python3 scripts/shopify-setup.py sync-config` (neue Variant-IDs → `config.local.js`)

Preise parallel per **Bulk edit** auf 59,00 € oder `sync-prices` mit API.

### Live-Katalog im Deck Shop (Storefront, Shopify = SSOT)

Nach Freischaltung lädt `shopify-storefront-catalog.js` **Preis, Compare-at, Bestand** pro Deck-SKU via Storefront GraphQL.

1. **Storefront Access Token** in `deck-shop/config.js` oder `config.local.js` / `?dev=1` setzen  
2. Produkte müssen im **Online Store** kanal sichtbar sein  
3. Fallback ohne Token: lokales `INITIAL_STOCK` aus `deck-inventory.js`

Aktualisierung: beim Shop-Unlock, alle 5 Min (Tab sichtbar), nach Tab-Wechsel, 90s Session-Cache.
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
