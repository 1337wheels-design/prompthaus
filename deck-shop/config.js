/**
 * Payday Deck Shop — Shopify Konfiguration
 *
 * Setup:
 * 1. Shopify Admin → Products → Import → ../../shopify/products.csv
 * 2. Pro Variante die numerische ID kopieren (Admin-URL …/variants/123456789)
 * 3. shopDomain: dein-store.myshopify.com (ohne https://)
 * 4. variantId pro SKU unten eintragen
 *
 * Docs: shopify/SETUP.md (Hybrid Option C)
 */
window.PAYDAY_SHOP = {
  shopDomain: 'xwk1u9-6z.myshopify.com',

  /** Nach Checkout / „Weiter einkaufen“ zurück zum Deck Shop (GitHub Pages). */
  checkoutReturnUrl: 'https://1337wheels-design.github.io/prompthaus/deck-shop/',

  /**
   * Inventar-Holds (5 Min) — Supabase Edge Function (Option B) oder Node-Proxy.
   * Live: https://DEIN_PROJECT_REF.supabase.co/functions/v1/reservation-api
   * Lokal: http://127.0.0.1:8791 oder ?reserveApi=…
   * Setup: supabase/SETUP.md
   */
  reservationApiUrl: 'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api',

  /** Reservierungs-TTL in ms (Default serverseitig: 5 Min). */
  reservationTtlMs: 5 * 60 * 1000,

  /**
   * Stufe A: leichtes Availability-Polling (nur reservation-api, kein Shopify-Sync).
   * Ergänzt shop-sync-Cron — z. B. 75 s; Tab im Hintergrund pausiert.
   */
  availabilityPollMs: 75 * 1000,

  /**
   * Storefront Public Token — für Live-Bestand/Preise (shopify-storefront-catalog.js).
   * Headless-App → Storefront API. Öffentlich im Browser OK (kein Admin-shpat).
   * Alternativ: ?dev=1 → Shopify-Modal oder config.local.js
   */
  storefrontAccessToken: '',

  /**
   * Keys = Inventar-SKU aus deck-inventory.js (designId-sizeId)
   * handle = Shopify Product Handle (aus products.csv)
   * variantId = numerische Shopify Variant ID (nach Import)
   */
  deckVariants: {
    'chrome-838': { handle: 'payday-deck-chrome-838', variantId: 67670522429725 },
    'chrome-850': { handle: 'payday-deck-chrome-850', variantId: 67670523150621 },
    'neon-838': { handle: 'payday-deck-neon-838', variantId: 67670523445533 },
    'neon-850': { handle: 'payday-deck-neon-850', variantId: 67670524002589 },
    'payday-linear-838': { handle: 'payday-deck-linear-838', variantId: 67670524068125 },
    'payday-linear-850': { handle: 'payday-deck-linear-850', variantId: 67670524723485 },
    'arctic-838': { handle: 'payday-deck-arctic-838', variantId: 67670525477149 },
    'arctic-850': { handle: 'payday-deck-arctic-850', variantId: 67670525837597 },
    'night-838': { handle: 'payday-deck-night-838', variantId: 67670526591261 },
    'night-850': { handle: 'payday-deck-night-850', variantId: 67670526689565 },
    'payday-camo-838': { handle: 'payday-deck-camo-838', variantId: 67670527377693 },
    'payday-camo-850': { handle: 'payday-deck-camo-850', variantId: 67670527770909 },
  },

  /** Event-Packs (optional, für gemeinsame Navigation mit shop/) */
  packVariants: {
    'event-ticket': { handle: 'event-ticket', variantId: 67670520004893 },
    'single-pack': { handle: 'single-pack', variantId: 67670520725789 },
    'double-pack': { handle: 'double-pack', variantId: 67670521512221 },
    'triple-pack': { handle: 'triple-pack', variantId: 67670521577757 },
    'art-print-attitude': { handle: 'art-print-attitude', variantId: 67670529179933 },
  },
};
