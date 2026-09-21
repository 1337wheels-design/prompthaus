/**
 * Vollständiger Katalog der Drive-Artefakte (28 SVGs).
 * https://drive.google.com/drive/folders/1ogAECk3I-Rn9WAc-zNjf0tHpdDRyD-5_
 */
(function (global) {
  const DRIVE_FOLDER_URL =
    'https://drive.google.com/drive/folders/1ogAECk3I-Rn9WAc-zNjf0tHpdDRyD-5_?usp=sharing';

  const CATEGORIES = {
    'deck-graphic': {
      id: 'deck-graphic',
      label: 'Deck-Grafiken',
      description: 'Horizontale Board-Comps (2123×549), Camo/Linear-Fills im Skateboard-Silhouette-Clip.',
    },
    'ui-reticle': {
      id: 'ui-reticle',
      label: 'Fadenkreuz & Zielhilfen',
      description: 'Stroke-UI für Editor/Show — Kreise, Eckenstrahlen, Mittelkreuz.',
    },
    'ui-axis': {
      id: 'ui-axis',
      label: 'Achsen & Guides',
      description: 'Minimalistische Hilfslinien (ohne Voll-Retikel).',
    },
    'brand-frame': {
      id: 'brand-frame',
      label: 'Marken-Rahmen',
      description: 'Payday-Eck-Polygone, L-Frames und vertikale Keilformen.',
    },
    'brand-tile': {
      id: 'brand-tile',
      label: 'Kachel-Motive',
      description: 'Rotierte Eck-/Kreuz-Polygone für Patterns & UI-Tiles.',
    },
    production: {
      id: 'production',
      label: 'Produktion',
      description: 'Platzhalter, Masken, Druckflächen.',
    },
  };

  const ARTIFACTS = [
    { id: 'el-12', file: 'Element 12.svg', num: 12, category: 'ui-reticle', name: 'Retikel Voll', usage: 'Scroll-Parallax, Editor-Overlay', integration: 'ornament' },
    { id: 'el-13', file: 'Element 13.svg', num: 13, category: 'ui-axis', name: 'Eckenstrahlen + Achse', usage: 'Swipe-Hinweis, Zonen-Markierung', integration: 'ornament' },
    { id: 'el-14', file: 'Element 14.svg', num: 14, category: 'ui-reticle', name: 'Retikel + Innenkreis', usage: 'Fokus auf aktives Deck', integration: 'ornament' },
    { id: 'el-15', file: 'Element 15.svg', num: 15, category: 'ui-axis', name: 'Kreuzachse', usage: 'Minimaler Guide', integration: 'ornament' },
    { id: 'el-16', file: 'Element 16.svg', num: 16, category: 'ui-reticle', name: 'Doppelring + Achse', usage: 'Hero-Overlay', integration: 'ornament' },
    { id: 'el-17', file: 'Element 17.svg', num: 17, category: 'ui-reticle', name: 'Innenring + Achse', usage: 'Progress-Marker', integration: 'ornament' },
    { id: 'el-18', file: 'Element 18.svg', num: 18, category: 'brand-frame', name: 'Frame TL', usage: 'Ecke Shop-Kachel', integration: 'ornament' },
    { id: 'el-19', file: 'Element 19.svg', num: 19, category: 'brand-frame', name: 'Frame TR', usage: 'Spiegel-Frame', integration: 'ornament' },
    { id: 'el-21', file: 'Element 21.svg', num: 21, category: 'brand-frame', name: 'Vertikal-Keil', usage: 'Sidebar-Akzent', integration: 'ornament' },
    { id: 'el-22', file: 'Element 22.svg', num: 22, category: 'brand-frame', name: 'Block-Frame', usage: 'Kartenrahmen Event-Site', integration: 'ornament' },
    { id: 'el-24', file: 'Element 24.svg', num: 24, category: 'brand-tile', name: 'Tile A', usage: 'Pattern-Repeat', integration: 'ornament' },
    { id: 'el-25', file: 'Element 25.svg', num: 25, category: 'brand-tile', name: 'Tile B', usage: 'Pattern-Repeat', integration: 'ornament' },
    { id: 'el-26', file: 'Element 26.svg', num: 26, category: 'brand-tile', name: 'Tile Stern', usage: 'Loader / Badge', integration: 'ornament' },
    { id: 'el-27', file: 'Element 27.svg', num: 27, category: 'brand-tile', name: 'Tile Plus', usage: 'Grid-Füller', integration: 'ornament' },
    { id: 'el-28', file: 'Element 28.svg', num: 28, category: 'production', name: 'Matt-Platzhalter', usage: 'Breitenbezug 3:1, Druckfläche', integration: 'reference' },
    {
      id: 'el-39', file: 'Element 39.svg', num: 39, category: 'deck-graphic', name: 'Grey Cherry',
      palette: ['#9a9a9a', '#c33c54'], usage: 'Scroll-Slide, Shop-Thumb-Mapping', integration: 'slide',
      tag: 'Camo · 2-Farbig',
    },
    {
      id: 'el-41', file: 'Element 41.svg', num: 41, category: 'deck-graphic', name: 'Sand Camo',
      palette: ['#f3efe0', '#d8c99b'], usage: 'Hero-Deck', integration: 'slide', tag: 'Camo',
    },
    {
      id: 'el-42', file: 'Element 42.svg', num: 42, category: 'deck-graphic', name: 'Teal Zebra',
      palette: ['#f4f1de', '#042a2b'], usage: 'Kontrast-Variante', integration: 'slide', tag: 'Linear',
    },
    {
      id: 'el-43', file: 'Element 43.svg', num: 43, category: 'deck-graphic', name: 'Arctic Stripe',
      palette: ['#d3d4d9', '#4b88a2'], usage: 'Cool-Tone', integration: 'slide', tag: 'Linear',
    },
    {
      id: 'el-44', file: 'Element 44.svg', num: 44, category: 'deck-graphic', name: 'Night Mono',
      palette: ['#a2a3bb', '#000807'], usage: 'Dark UI Pairing', integration: 'slide', tag: 'Camo',
    },
    {
      id: 'el-45', file: 'Element 45.svg', num: 45, category: 'deck-graphic', name: 'Coral Slate',
      palette: ['#686963', '#db5461'], usage: 'Shop-Grid', integration: 'slide', tag: 'Camo',
    },
    {
      id: 'el-46', file: 'Element 46.svg', num: 46, category: 'deck-graphic', name: 'Cream Logo Plate',
      palette: ['#f3efe0'], usage: 'Logo-only / Underlay', integration: 'slide', tag: 'Mono',
    },
    {
      id: 'el-47', file: 'Element 47.svg', num: 47, category: 'deck-graphic', name: 'Cream Variant',
      palette: ['#f3efe0'], usage: 'Alternative Silhouette-Fill', integration: 'slide', tag: 'Mono',
    },
    {
      id: 'el-48', file: 'Element 48.svg', num: 48, category: 'deck-graphic', name: 'Hot Pink',
      palette: ['#ffe3dc', '#d30c7b'], usage: 'Neon-Story', integration: 'slide', tag: 'Camo',
    },
    {
      id: 'el-49', file: 'Element 49.svg', num: 49, category: 'deck-graphic', name: 'Gold Earth',
      palette: ['#d5a021', '#4b4237'], usage: 'Warm Accent', integration: 'slide', tag: 'Camo',
    },
    {
      id: 'el-50', file: 'Element 50.svg', num: 50, category: 'deck-graphic', name: 'Burgundy Sand',
      palette: ['#d8c99b', '#a4243b'], usage: 'SS26 Alt', integration: 'slide', tag: 'Camo',
    },
    {
      id: 'el-51', file: 'Element 51.svg', num: 51, category: 'deck-graphic', name: 'Slate Violet',
      palette: ['#9a9a9a', '#3a405a'], usage: 'Purple Theme Pairing', integration: 'slide', tag: 'Linear',
    },
    {
      id: 'el-52', file: 'Element 52.svg', num: 52, category: 'deck-graphic', name: 'Grey Cherry (Dup)',
      palette: ['#9a9a9a', '#c33c54'], usage: 'Export-Duplikat von #39', integration: 'slide', tag: 'Camo · Dup',
    },
  ];

  function byCategory(catId) {
    return ARTIFACTS.filter((a) => a.category === catId);
  }

  function deckSlides() {
    return ARTIFACTS.filter((a) => a.integration === 'slide').map((a) => ({
      id: a.id,
      file: a.file,
      label: a.name,
      tag: a.tag || 'Deck',
      palette: a.palette,
    }));
  }

  function ornaments() {
    return ARTIFACTS.filter((a) => a.integration === 'ornament').map((a, i) => ({
      id: a.id,
      file: a.file,
      depth: 0.32 + (i % 5) * 0.08,
      name: a.name,
      category: a.category,
    }));
  }

  function stats() {
    const counts = {};
    ARTIFACTS.forEach((a) => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });
    return {
      total: ARTIFACTS.length,
      byCategory: counts,
      deckGraphics: counts['deck-graphic'] || 0,
      uiAndBrand: ARTIFACTS.length - (counts['deck-graphic'] || 0) - (counts.production || 0),
    };
  }

  global.PAYDAY_ARTIFACT_CATALOG = {
    DRIVE_FOLDER_URL,
    CATEGORIES,
    ARTIFACTS,
    byCategory,
    deckSlides,
    ornaments,
    stats,
  };
})(window);
