/**
 * Payday Deck — physischer Bestand (Druck-PDFs)
 * Stand: Produktionsliste vom Veranstalter
 */
(function (global) {
  const DESIGNS = [
    { id: 'chrome',       name: 'CHROME',       pdf: 'payday_CHROME.pdf',       camoIndex: 15, camoStyle: 'blob' },
    { id: 'neon',         name: 'NEON',         pdf: 'payday_NEON.pdf',         camoIndex: 4,  camoStyle: 'blob' },
    { id: 'payday-linear', name: 'PAYDAY Linear', pdf: 'payday_PAYDAY_Linear.pdf', camoIndex: 0,  camoStyle: 'linear' },
    { id: 'arctic',       name: 'ARCTIC',       pdf: 'payday_ARCTIC.pdf',       camoIndex: 3,  camoStyle: 'blob' },
    { id: 'night',        name: 'NIGHT',        pdf: 'payday_NIGHT.pdf',        camoIndex: 5,  camoStyle: 'blob' },
    { id: 'payday-camo',  name: 'PAYDAY Camo',  pdf: 'payday_PAYDAY_Camo.pdf',  camoIndex: 0,  camoStyle: 'blob' },
  ];

  const SIZES = [
    { id: '838', label: '8.38"', widthIn: 8.38, price: 89 },
    { id: '850', label: '8.5"',  widthIn: 8.5,  price: 94 },
  ];

  /** Anfangsbestand pro SKU (design-id + size-id) */
  const INITIAL_STOCK = {
    'chrome-838': 5,       'chrome-850': 5,
    'neon-838': 4,         'neon-850': 4,
    'payday-linear-838': 4, 'payday-linear-850': 4,
    'arctic-838': 4,       'arctic-850': 4,
    'night-838': 4,        'night-850': 4,
    'payday-camo-838': 4,  'payday-camo-850': 4,
  };

  function skuId(designId, sizeId) {
    return `${designId}-${sizeId}`;
  }

  function buildCatalog(stock) {
    const items = [];
    DESIGNS.forEach((design) => {
      SIZES.forEach((size) => {
        const id = skuId(design.id, size.id);
        items.push({
          id,
          designId: design.id,
          designName: design.name,
          pdf: design.pdf,
          camoIndex: design.camoIndex,
          camoStyle: design.camoStyle,
          camoOnly: true,
          sizeId: size.id,
          sizeLabel: size.label,
          widthIn: size.widthIn,
          title: design.name,
          price: size.price,
          stock: stock[id] ?? 0,
        });
      });
    });
    return items;
  }

  function totalStock(stock) {
    return Object.values(stock).reduce((s, n) => s + n, 0);
  }

  function cloneStock() {
    return { ...INITIAL_STOCK };
  }

  global.PAYDAY_DECK_INVENTORY = {
    DESIGNS,
    SIZES,
    INITIAL_STOCK,
    skuId,
    buildCatalog,
    totalStock,
    cloneStock,
  };
})(window);
