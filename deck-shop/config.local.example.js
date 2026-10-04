/**
 * Kopie als config.local.js (gitignored) — feste Werte ohne Browser-Dialog.
 * Alternativ: im Shop auf „Shopify“ klicken (speichert in localStorage).
 */
window.PAYDAY_SHOP = {
  ...(window.PAYDAY_SHOP || {}),
  shopDomain: 'dein-store.myshopify.com',
  storefrontAccessToken: 'DEIN_STOREFRONT_PUBLIC_TOKEN',
  reservationApiUrl: 'http://127.0.0.1:8791',
};
