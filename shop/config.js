/**
 * Üpark Payday — Shopify Konfiguration
 *
 * Nach Shop-Erstellung anpassen:
 * 1. shopDomain: dein-store.myshopify.com
 * 2. storefrontAccessToken: Storefront API (nur für Headless/JS-Storefront)
 * 3. buyButtonComponents: IDs aus Shopify Admin → Buy Button
 */
window.PAYDAY_SHOP = {
  // Option C/D: Hybrid oder Buy Button
  shopDomain: 'YOUR-STORE.myshopify.com',

  // GitHub Pages Basis-URL (ohne trailing slash)
  galleryBaseUrl: '../cards/index.html',

  // Storefront API (Option B — optional)
  storefrontAccessToken: '',

  // Produkte für statische Karten-Darstellung (Preise aus products.csv)
  products: [
    {
      handle: 'event-ticket',
      title: 'Event-Ticket',
      price: '15,00 €',
      description: 'Einlass + Basic Pack',
      tombola: 0,
      variantId: null, // Shopify Variant ID nach Import
    },
    {
      handle: 'single-pack',
      title: 'Single Pack',
      price: '8,00 €',
      description: '1 Sponsor-Karte',
      tombola: 1,
      variantId: null,
    },
    {
      handle: 'double-pack',
      title: 'Double Pack',
      price: '18,00 €',
      description: '2 Sponsor-Karten',
      tombola: 3,
      variantId: null,
    },
    {
      handle: 'triple-pack',
      title: 'Triple Pack',
      price: '35,00 €',
      description: '3 Karten + Bonus',
      tombola: 7,
      variantId: null,
    },
    {
      handle: 'payday-deck',
      title: 'Payday Deck',
      price: '89,00 €',
      description: 'Custom Camo Deck',
      tombola: 0,
      variantId: null,
    },
    {
      handle: 'art-print-attitude',
      title: 'Art Print',
      price: '25,00 €',
      description: 'Attitude Bremen, limitiert',
      tombola: 0,
      variantId: null,
    },
  ],

  // Buy Button component IDs (aus Shopify Admin kopieren)
  buyButtonComponents: {
    'event-ticket': null,
    'single-pack': null,
    'double-pack': null,
    'triple-pack': null,
  },
};
