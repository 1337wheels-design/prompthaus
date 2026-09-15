/**
 * Payday Deck Shop — Inventar + PDF-extrahierte Board-Grafiken
 * Graphics: embedded JPEG aus Drive-PDFs (3600×12600), SHA256-verifiziert
 * Quelle: https://drive.google.com/drive/folders/1KNwdtloI6V2gwS68tyxy_XjhWborrlvB
 */
(function (global) {
  const ASSETS_BASE = 'assets/';
  const DRIVE_FOLDER_URL =
    'https://drive.google.com/drive/folders/1KNwdtloI6V2gwS68tyxy_XjhWborrlvB?usp=sharing';

  /** Extrahiert aus PDF embedded images — manifest.json */
  const BOARD_MANIFEST = {
    payday_ARCTIC: {
      pdf: 'payday_ARCTIC.pdf',
      sha256: '64a05ccf1783de850e199551829cde06b442dc8d582fa59d0ce46e20b716b5fc',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_ARCTIC-thumb.jpg',
      preview: 'boards/payday_ARCTIC-preview.jpg',
    },
    payday_CHROME: {
      pdf: 'payday_CHROME.pdf',
      sha256: 'ce561e723c5d119dc6ee37506b76a0068d5a86aa86085b53d2880ef2843576c1',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_CHROME-thumb.jpg',
      preview: 'boards/payday_CHROME-preview.jpg',
    },
    payday_NEON: {
      pdf: 'payday_NEON.pdf',
      sha256: '6d40e3dee57da672bc444ac0b885507eaaad5ca4069d38607ad9ded0481c53ad',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_NEON-thumb.jpg',
      preview: 'boards/payday_NEON-preview.jpg',
    },
    payday_NIGHT: {
      pdf: 'payday_NIGHT.pdf',
      sha256: '3f0cd8fda663c181facccef3a4fe3af8543c1c0e0970e7c434822bd022352d45',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_NIGHT-thumb.jpg',
      preview: 'boards/payday_NIGHT-preview.jpg',
    },
    payday_PAYDAY: {
      pdf: 'payday_PAYDAY.pdf',
      sha256: '2d047cd355a1e8db3139d15b3ec6ea688d85f0df9d5049e08ece82659c238634',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_PAYDAY-thumb.jpg',
      preview: 'boards/payday_PAYDAY-preview.jpg',
    },
    payday_PAYDAY_Linear: {
      pdf: 'payday_PAYDAY_Linear.pdf',
      sha256: '80e4181f9a7a4ec223feab0514761d504dc0953772a1b69abf9488b76ffbd18f',
      width: 3600,
      height: 12600,
      thumb: 'boards/payday_PAYDAY_Linear-thumb.jpg',
      preview: 'boards/payday_PAYDAY_Linear-preview.jpg',
    },
  };

  /**
   * Editor engine mapping (decks/editor.html CAMO_PATTERNS + camoStyle).
   * manifestKey always matches the physical Druck-PDF filename on Drive.
   */
  const DESIGNS = [
    { id: 'chrome', name: 'CHROME', manifestKey: 'payday_CHROME', driveId: '1-sd4Vy8id4IaTDD0arnv6gKhYImCF5sM', camoIndex: 15, camoStyle: 'blob', patternLabel: 'Camo' },
    { id: 'neon', name: 'NEON', manifestKey: 'payday_NEON', driveId: '150wocQj8Pp6YYADu4aj_zyjUXmnz-q-H', camoIndex: 4, camoStyle: 'blob', patternLabel: 'Camo' },
    { id: 'payday-linear', name: 'PAYDAY Linear', manifestKey: 'payday_PAYDAY_Linear', driveId: '1l5LnU9eAI6ft9ZpEdh8-KeXRC2vDdIwb', camoIndex: 0, camoStyle: 'linear', patternLabel: 'Linear' },
    { id: 'arctic', name: 'ARCTIC', manifestKey: 'payday_ARCTIC', driveId: '1e4ux5YIHkDg9qrYyNR4Z7xXxeCY4gYH7', camoIndex: 3, camoStyle: 'linear', patternLabel: 'Linear' },
    { id: 'night', name: 'NIGHT', manifestKey: 'payday_NIGHT', driveId: '1qrlZZqr1X204vqp2_PuOuHEcyM2ZmaEq', camoIndex: 5, camoStyle: 'blob', patternLabel: 'Camo' },
    { id: 'payday-camo', name: 'PAYDAY Camo', manifestKey: 'payday_PAYDAY', driveId: '1iuEOWM_ovSGEKXFdshXnaGnFROXG2X9s', camoIndex: 0, camoStyle: 'blob', patternLabel: 'Camo' },
  ];

  const SIZES = [
    { id: '838', label: '8.38"', widthIn: 8.38, price: 89 },
    { id: '850', label: '8.5"', widthIn: 8.5, price: 94 },
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

  function pdfLocalUrl(design) {
    return assetUrl('pdfs/' + getBoardMeta(design).pdf);
  }

  function pdfDriveUrl(driveId) {
    return `https://drive.google.com/file/d/${driveId}/view`;
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
          pdf: meta.pdf,
          sha256: meta.sha256,
          thumbUrl: thumbUrl(design),
          previewUrl: previewUrl(design),
          pdfUrl: pdfLocalUrl(design),
          pdfDriveUrl: pdfDriveUrl(design.driveId),
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
    DRIVE_FOLDER_URL,
    BOARD_MANIFEST,
    DESIGNS,
    SIZES,
    INITIAL_STOCK,
    assetUrl,
    getBoardMeta,
    thumbUrl,
    previewUrl,
    pdfLocalUrl,
    pdfDriveUrl,
    skuId,
    getDesignById,
    buildCatalog,
    totalStock,
    cloneStock,
  };
})(window);
