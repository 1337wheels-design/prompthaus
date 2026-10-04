/**
 * Payday Deck Shop — Inventar + Board-Grafiken
 * Graphics: embedded JPEGs (3600×12600), SHA256-verifiziert
 */
(function (global) {
  const ASSETS_BASE = 'assets/';

  const BOARD_MANIFEST = {
    payday_ARCTIC: {
      source: 'payday_ARCTIC',
      sha256: '64a05ccf1783de850e199551829cde06b442dc8d582fa59d0ce46e20b716b5fc',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_ARCTIC-thumb.jpg',
      preview: 'boards/payday_ARCTIC-preview.jpg',
    },
    payday_CHROME: {
      source: 'payday_CHROME',
      sha256: 'ce561e723c5d119dc6ee37506b76a0068d5a86aa86085b53d2880ef2843576c1',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_CHROME-thumb.jpg',
      preview: 'boards/payday_CHROME-preview.jpg',
    },
    payday_NEON: {
      source: 'payday_NEON',
      sha256: '6d40e3dee57da672bc444ac0b885507eaaad5ca4069d38607ad9ded0481c53ad',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_NEON-thumb.jpg',
      preview: 'boards/payday_NEON-preview.jpg',
    },
    payday_NIGHT: {
      source: 'payday_NIGHT',
      sha256: '3f0cd8fda663c181facccef3a4fe3af8543c1c0e0970e7c434822bd022352d45',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_NIGHT-thumb.jpg',
      preview: 'boards/payday_NIGHT-preview.jpg',
    },
    payday_PAYDAY: {
      source: 'payday_PAYDAY',
      sha256: '2d047cd355a1e8db3139d15b3ec6ea688d85f0df9d5049e08ece82659c238634',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_PAYDAY-thumb.jpg',
      preview: 'boards/payday_PAYDAY-preview.jpg',
    },
    payday_PAYDAY_Linear: {
      source: 'payday_PAYDAY_Linear',
      sha256: '80e4181f9a7a4ec223feab0514761d504dc0953772a1b69abf9488b76ffbd18f',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_PAYDAY_Linear-thumb.jpg',
      preview: 'boards/payday_PAYDAY_Linear-preview.jpg',
    },
  };

  /**
   * Editor engine mapping (decks/editor.html CAMO_PATTERNS + camoStyle).
   */
  const DESIGNS = [
    { id: 'chrome', name: 'CHROME', manifestKey: 'payday_CHROME', camoIndex: 15, camoStyle: 'blob', patternLabel: 'Camo', logoScale: 0.72 },
    { id: 'neon', name: 'NEON', manifestKey: 'payday_NEON', camoIndex: 4, camoStyle: 'blob', patternLabel: 'Camo', logoScale: 0.72 },
    { id: 'payday-linear', name: 'PAYDAY Linear', manifestKey: 'payday_ARCTIC', camoIndex: 3, camoStyle: 'linear', patternLabel: 'Linear', logoScale: 1.0 },
    { id: 'arctic', name: 'ARCTIC', manifestKey: 'payday_PAYDAY_Linear', camoIndex: 0, camoStyle: 'linear', patternLabel: 'Linear', logoScale: 1.0 },
    { id: 'night', name: 'NIGHT', manifestKey: 'payday_NIGHT', camoIndex: 5, camoStyle: 'blob', patternLabel: 'Camo', logoScale: 0.72 },
    { id: 'payday-camo', name: 'PAYDAY Camo', manifestKey: 'payday_PAYDAY', camoIndex: 0, camoStyle: 'blob', patternLabel: 'Camo', logoScale: 0.72 },
  ];

  const DECK_PRICE = 59;

  const SIZES = [
    { id: '838', label: '8.38"', widthIn: 8.38, price: DECK_PRICE },
    { id: '850', label: '8.5"', widthIn: 8.5, price: DECK_PRICE },
  ];

  const INITIAL_STOCK = {
    'chrome-838': 5, 'chrome-850': 5,
    'neon-838': 4, 'neon-850': 4,
    'payday-linear-838': 4, 'payday-linear-850': 4,
    'arctic-838': 4, 'arctic-850': 4,
    'night-838': 4, 'night-850': 4,
    'payday-camo-838': 4, 'payday-camo-850': 4,
  };

  function assetUrl(relativePath) {
    return ASSETS_BASE + relativePath;
  }

  function getBoardMeta(design) {
    return BOARD_MANIFEST[design.manifestKey];
  }

  function thumbUrl(design) {
    return assetUrl(getBoardMeta(design).thumb);
  }

  function previewUrl(design) {
    return assetUrl(getBoardMeta(design).preview);
  }

  function skuId(designId, sizeId) {
    return `${designId}-${sizeId}`;
  }

  function getDesignById(id) {
    return DESIGNS.find((d) => d.id === id);
  }

  function buildCatalog(stock) {
    const items = [];
    DESIGNS.forEach((design) => {
      const meta = getBoardMeta(design);
      SIZES.forEach((size) => {
        const id = skuId(design.id, size.id);
        items.push({
          id,
          designId: design.id,
          designName: design.name,
          manifestKey: design.manifestKey,
          camoIndex: design.camoIndex,
          camoStyle: design.camoStyle,
          patternLabel: design.patternLabel,
          source: meta.source,
          sha256: meta.sha256,
          thumbUrl: thumbUrl(design),
          previewUrl: previewUrl(design),
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
    ASSETS_BASE,
    BOARD_MANIFEST,
    DESIGNS,
    SIZES,
    INITIAL_STOCK,
    assetUrl,
    getBoardMeta,
    thumbUrl,
    previewUrl,
    skuId,
    getDesignById,
    buildCatalog,
    totalStock,
    cloneStock,
  };
})(window);
