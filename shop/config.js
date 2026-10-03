/**
 * Üpark Payday — Shopify Konfiguration (Event-Landing shop/)
 * Deck-Konfigurator: ../deck-shop/ (eigene config.js + Variant-Map)
 */
window.PAYDAY_SHOP = {
  shopDomain: 'xwk1u9-6z.myshopify.com',
  storefrontAccessToken: '',
  galleryBaseUrl: '../cards/index.html',
  deckShopUrl: '../deck-shop/',

  products: [
    {
      handle: 'event-ticket',
      title: 'Event-Ticket',
      price: '15,00 €',
      description: 'Einlass + Basic Pack',
      tombola: 0,
      variantId: null,
    },
    {
      handle: 'single-pack',
      title: 'Single Pack',
      price: '8,00 €',
      description: '1 Sponsor-Karte · 1 Tombola-Los',
      tombola: 1,
      variantId: null,
    },
    {
      handle: 'double-pack',
      title: 'Double Pack',
      price: '18,00 €',
      description: '2 Karten · 3 Tombola-Lose',
      tombola: 3,
      variantId: null,
    },
    {
      handle: 'triple-pack',
      title: 'Triple Pack',
      price: '35,00 €',
      description: '3 Karten + Bonus · 7 Lose',
      tombola: 7,
      variantId: null,
    },
    {
      handle: 'payday-deck',
      title: 'Payday Deck SS26',
      price: '59,00 € inkl. Griptape',
      description: '6 Designs · 8.38″ & 8.5″ · Konfigurator',
      tombola: 0,
      variantId: null,
      configuratorUrl: '../deck-shop/',
    },
    {
      handle: 'art-print-attitude',
      title: 'Art Print Attitude',
      price: '25,00 €',
      description: 'Limitiert · A3',
      tombola: 0,
      variantId: null,
    },
  ],

  buyButtonComponents: {
    'event-ticket': null,
    'single-pack': null,
    'double-pack': null,
    'triple-pack': null,
  },
};
