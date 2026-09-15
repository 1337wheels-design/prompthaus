/**
 * Payday Deck — physischer Bestand + PDF-Druckdaten
 * Quelle: https://drive.google.com/drive/folders/1KNwdtloI6V2gwS68tyxy_XjhWborrlvB
 * Order.txt (SS26): 50 Decks · 25× 8.38″ · 25× 8.5″
 */
(function (global) {
  const DRIVE_FOLDER_URL =
    'https://drive.google.com/drive/folders/1KNwdtloI6V2gwS68tyxy_XjhWborrlvB?usp=sharing';

  const PDF_BASE = 'assets/pdfs/';

  const DESIGNS = [
    {
      id: 'chrome',
      name: 'CHROME',
      pdf: 'payday_CHROME.pdf',
      driveId: '1-sd4Vy8id4IaTDD0arnv6gKhYImCF5sM',
      camoIndex: 15,
      camoStyle: 'blob',
    },
    {
      id: 'neon',
      name: 'NEON',
      pdf: 'payday_NEON.pdf',
      driveId: '150wocQj8Pp6YYADu4aj_zyjUXmnz-q-H',
      camoIndex: 4,
      camoStyle: 'blob',
    },
    {
      id: 'payday-linear',
      name: 'PAYDAY Linear',
      pdf: 'payday_PAYDAY_Linear.pdf',
      driveId: '1l5LnU9eAI6ft9ZpEdh8-KeXRC2vDdIwb',
      camoIndex: 0,
      camoStyle: 'linear',
    },
    {
      id: 'arctic',
      name: 'ARCTIC',
      pdf: 'payday_ARCTIC.pdf',
      driveId: '1e4ux5YIHkDg9qrYyNR4Z7xXxeCY4gYH7',
      camoIndex: 3,
      camoStyle: 'blob',
    },
    {
      id: 'night',
      name: 'NIGHT',
      pdf: 'payday_NIGHT.pdf',
      driveId: '1qrlZZqr1X204vqp2_PuOuHEcyM2ZmaEq',
      camoIndex: 5,
      camoStyle: 'blob',
    },
    {
      id: 'payday-camo',
      name: 'PAYDAY Camo',
      pdf: 'payday_PAYDAY.pdf',
      driveId: '1iuEOWM_ovSGEKXFdshXnaGnFROXG2X9s',
      camoIndex: 0,
      camoStyle: 'blob',
    },
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

  function skuId(designId, sizeId) {
    return `${designId}-${sizeId}`;
  }

  function pdfLocalUrl(pdfFile) {
    return PDF_BASE + pdfFile;
  }

  function pdfDriveUrl(driveId) {
    return `https://drive.google.com/file/d/${driveId}/view`;
  }

  function pdfDriveDownload(driveId) {
    return `https://drive.google.com/uc?export=download&id=${driveId}`;
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
          pdfUrl: pdfLocalUrl(design.pdf),
          pdfDriveUrl: pdfDriveUrl(design.driveId),
          pdfDownloadUrl: pdfDriveDownload(design.driveId),
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

  function getDesignById(id) {
    return DESIGNS.find((d) => d.id === id);
  }

  global.PAYDAY_DECK_INVENTORY = {
    DRIVE_FOLDER_URL,
    PDF_BASE,
    DESIGNS,
    SIZES,
    INITIAL_STOCK,
    skuId,
    pdfLocalUrl,
    pdfDriveUrl,
    pdfDriveDownload,
    buildCatalog,
    totalStock,
    cloneStock,
    getDesignById,
  };
})(window);
