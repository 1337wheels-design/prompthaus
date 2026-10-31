# Payday Shop (Shopify Theme)

Vollständiger **Deck-Konfigurator** wie auf [Vercel](https://1337wheels-design-payday.vercel.app/deck-shop/):

- Intro-Swipe durch alle Designs
- **3× Wischen** zum Freischalten des Shops
- Grid, Warenkorb, Checkout → Shopify

## Deploy

```bash
npm install
npm run shopify:theme:login
npm run shopify:theme:push
```

Im Admin das hochgeladen Theme **Payday Shop** veröffentlichen (Startseite = `templates/index.json`).

## Assets

Schwere Dateien (SVG-Illustrationen, Board-JPEGs) kommen von der **CDN-URL** (Theme-Einstellung `cdn_base`, Default Vercel). JS/CSS liegen in `assets/` und werden mit dem Theme mitgepusht.

Nach Änderungen am `deck-shop/`:

```bash
npm run shopify:theme:sync
npm run shopify:theme:push
```

## Farben / CSS

Deck-Shop = **Lila/Nacht** (`#0a0812`, `--purple`), nicht die gold/grünen Event-Sections (`payday-hero.liquid`).

Reihenfolge: `payday-deck-shop-shell.css` → `payday-deck-shop.css` → `payday-deck-shop-shopify-overrides.css` (Shopify-Wrapper).

Nach `theme:sync` darf `shell.css` **keine** `<style>`-Tags enthalten (sonst wirkt alles zu hell).

## Einstellungen (Theme Editor)

- **Storefront Public Token** — Live-Bestand im Grid (Shopify Admin → Headless App)
- **Supabase Reservierungen** — optional (Default aus für reinen Shopify-Betrieb)
