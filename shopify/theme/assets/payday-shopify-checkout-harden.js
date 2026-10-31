(function hardenPaydayCheckoutUrls() {
  const SH = window.PAYDAY_SHOPIFY_CHECKOUT;
  if (!SH) return;
  const fix =
    SH.sanitizeCheckoutUrl?.bind(SH) ||
    function (u) {
      return String(u || '')
        .replace(/([?&])checkout=(?=&|$)/g, '$1checkout')
        .replace(/checkout=&/g, 'checkout&');
    };
  const wrapReturn = SH.withCheckoutReturn?.bind(SH);
  if (wrapReturn) {
    SH.withCheckoutReturn = (raw, cfg) => fix(wrapReturn(raw, cfg));
  }
  const build = SH.buildCartCheckout.bind(SH);
  SH.buildCartCheckout = (cfg, items) => {
    const r = build(cfg, items);
    if (r?.url) r.url = fix(wrapReturn ? wrapReturn(r.url, cfg) : r.url);
    return r;
  };
})();
