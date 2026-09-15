# Üpark Payday 2026 — Shopify Integration

Anleitung, wie Event-Inhalt (Karten-Galerie, Zeitplan, Sponsoren) und Shopify-Shop auf **einer Website** zusammenlaufen.

> **Hinweis:** In dieser Cursor-Umgebung ist kein Shopify-MCP verbunden. Die Assets in diesem Ordner sind importfertig; der Shop wird in deinem Shopify-Admin angelegt und per Theme oder Embed angebunden.

---

## Architektur-Optionen (Übersicht)

| Ansatz | Aufwand | Wann sinnvoll |
|---|---|---|
| **A — Shopify Theme (empfohlen)** | Mittel | Eine Domain, ein Checkout, volle Kontrolle über Layout |
| **B — Headless (Hydrogen / Next.js)** | Hoch | Maximale Design-Freiheit, eigene Hosting-Infrastruktur |
| **C — Hybrid (Static + Shopify)** | Niedrig | Bestehende GitHub-Pages-Galerie behalten, Shop auf Subdomain |
| **D — Buy Button Embed** | Sehr niedrig | Schnellster Start, Checkout nur für wenige Produkte |

---

## A — Shopify Online Store 2.0 Theme (empfohlen)

**So funktioniert es:** Alles lebt unter einer Domain (z. B. `payday.uepark.de`). Shopify hostet Theme, Produkte, Checkout und DSGVO-konforme Zahlung.

```
payday.uepark.de/
├── /                    → Theme: Hero + Zeitplan + Karten + Shop
├── /collections/packs   → Sponsor-Packs (Single/Double/Triple)
├── /collections/merch   → Decks, Prints, Limited Drops
├── /pages/gallery       → eingebettete Karten-Galerie (iframe oder Section)
└── /cart, /checkout     → nativer Shopify-Flow
```

### Schritte

1. **Shop anlegen** — Shopify Admin → Store erstellen
2. **Produkte importieren** — `shopify/products.csv` unter *Products → Import*
3. **Theme hochladen** — Ordner `shopify/theme/` als ZIP oder per Shopify CLI:
   ```bash
   npm init @shopify/app@latest
   shopify theme push --path shopify/theme
   ```
4. **Assets verlinken** — Karten-Galerie:
   - Option 1: `cards/index.html` auf GitHub Pages lassen, in Section `payday-card-gallery.liquid` als iframe einbinden
   - Option 2: Screenshots/PNGs aus `export/` als Theme-Assets hochladen
5. **Navigation** — Menü: Event · Karten · Shop · Sponsoren · Kontakt

### Vorteile

- Ein Warenkorb, ein Checkout (PayPal, Klarna, Karte)
- Tombola-Lose als Line-Item-Properties oder Metafields
- Inventory für limitierte Packs

---

## B — Headless Commerce (Shopify Storefront API)

**So funktioniert es:** Deine React/Next.js-Site rendert alle Inhalte; Shopify liefert nur Katalog + Checkout über die Storefront API.

```
┌─────────────────────────────────────┐
│  Next.js / Hydrogen (Vercel)        │
│  ├── Event-Seiten (aus docs/)       │
│  ├── Karten-Galerie (Canvas/React)  │
│  └── Product Grid ← Storefront API  │
└──────────────┬──────────────────────┘
               │ GraphQL
┌──────────────▼──────────────────────┐
│  Shopify Backend                    │
│  Products · Cart · Checkout URL     │
└─────────────────────────────────────┘
```

- **Hydrogen** (Shopifys React-Framework): [https://hydrogen.shopify.dev](https://hydrogen.shopify.dev)
- Storefront API Token: Admin → Apps → Develop apps → Storefront API
- Checkout: `cart.checkoutUrl` leitet auf gehosteten Shopify-Checkout

---

## C — Hybrid (bestehende GitHub Pages + Shopify)

Passt zum aktuellen Repo-Setup (`index.html` → Karten-Galerie auf GitHub Pages).

```
1337wheels-design.github.io/prompthaus/   → Event + Karten (statisch)
shop.payday-uepark.myshopify.com          → Shopify Shop
```

**Einheitliche Navigation:** Header auf beiden Seiten mit identischen Links. Custom Domain:

| Subdomain | Ziel |
|---|---|
| `www.payday.de` | GitHub Pages (oder CNAME auf Pages) |
| `shop.payday.de` | Shopify Custom Domain |

Shopify Admin → *Settings → Domains → Connect existing domain*.

Die Demo-Landingpage unter `shop/index.html` zeigt dieses Pattern mit iframe + Buy Button.

---

## D — Shopify Buy Button (schnellster Start)

Kein Theme nötig. Shopify generiert Embed-Code pro Produkt:

1. Admin → *Sales channels → Buy Button*
2. Produkt wählen → *Generate embed code*
3. Code in `shop/index.html` einfügen (Platzhalter `YOUR_STORE` ersetzen)

```html
<div id="product-component-XXXXX"></div>
<script src="https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js"></script>
<script>/* Shopify Buy Button config */</script>
```

Checkout öffnet sich als Overlay oder Redirect — Shop bleibt optisch Teil deiner Seite.

---

## Produktkatalog (aus Event-Docs)

| Handle | Produkt | Tombola-Lose |
|---|---|---|
| `event-ticket` | Event-Ticket inkl. Basic Pack | 0 |
| `single-pack` | Sponsor Single Pack | 1 |
| `double-pack` | Sponsor Double Pack | 3 |
| `triple-pack` | Sponsor Triple Pack + Bonus | 7 |
| `payday-deck` | Custom Payday Deck (Camo) | 0 |
| `art-print-attitude` | Attitude Art Print (limitiert) | 0 |

Details in `shopify/products.csv`. Preise vor Launch mit Sponsoren finalisieren.

---

## DSGVO & Event-Logistik

- **Gewinnerdaten:** Shopify-Kundendaten ≠ Tombola-Gewinner — separates Opt-in-Formular am Event
- **Bargeldpreise:** Nicht über Shopify verkaufen; Cash-Blöcke vor Ort (siehe `docs/sponsors.md`)
- **Digitale Collectibles:** QR auf physischen Karten → Gallery-URL (kein Shopify nötig)

---

## Nächste Schritte

1. Shopify-Store erstellen und `products.csv` importieren
2. `shop/index.html` lokal testen (`python3 -m http.server` im Repo-Root)
3. Entscheidung A vs. C treffen (ein Domain vs. Hybrid)
4. Buy-Button-IDs oder Store-Domain in `shop/config.js` eintragen
5. Theme deployen oder GitHub Pages + Shopify verknüpfen
