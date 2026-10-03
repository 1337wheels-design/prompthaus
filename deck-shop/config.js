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
  shopDomain: 'YOUR-STORE.myshopify.com',

  /** Optional: Storefront API für erweiterten Headless-Cart (Hydrogen) */
  storefrontAccessToken: '',

  /**
   * Keys = Inventar-SKU aus deck-inventory.js (designId-sizeId)
   * handle = Shopify Product Handle (aus products.csv)
   * variantId = numerische Shopify Variant ID (nach Import)
   */
  deckVariants: {
    'chrome-838': { handle: 'payday-deck-chrome-838', variantId: null },
    'chrome-850': { handle: 'payday-deck-chrome-850', variantId: null },
    'neon-838': { handle: 'payday-deck-neon-838', variantId: null },
    'neon-850': { handle: 'payday-deck-neon-850', variantId: null },
    'payday-linear-838': { handle: 'payday-deck-linear-838', variantId: null },
    'payday-linear-850': { handle: 'payday-deck-linear-850', variantId: null },
    'arctic-838': { handle: 'payday-deck-arctic-838', variantId: null },
    'arctic-850': { handle: 'payday-deck-arctic-850', variantId: null },
    'night-838': { handle: 'payday-deck-night-838', variantId: null },
    'night-850': { handle: 'payday-deck-night-850', variantId: null },
    'payday-camo-838': { handle: 'payday-deck-camo-838', variantId: null },
    'payday-camo-850': { handle: 'payday-deck-camo-850', variantId: null },
  },

  /** Event-Packs (optional, für gemeinsame Navigation mit shop/) */
  packVariants: {
    'event-ticket': { handle: 'event-ticket', variantId: null },
    'single-pack': { handle: 'single-pack', variantId: null },
    'double-pack': { handle: 'double-pack', variantId: null },
    'triple-pack': { handle: 'triple-pack', variantId: null },
    'art-print-attitude': { handle: 'art-print-attitude', variantId: null },
  },
};
