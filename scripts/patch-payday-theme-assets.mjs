#!/usr/bin/env node
/** Theme-spezifische Pfad-Patches nach Sync aus deck-shop. */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../shopify/theme/assets');

const inv = readFileSync(join(dir, 'payday-deck-inventory.js'), 'utf8');
if (!inv.includes('PAYDAY_PATHS')) {
  writeFileSync(
    join(dir, 'payday-deck-inventory.js'),
    inv.replace(
      "const ASSETS_BASE = 'assets/';",
      "const ASSETS_BASE =\n    (typeof global !== 'undefined' && global.PAYDAY_PATHS && global.PAYDAY_PATHS.deckShopAssets) ||\n    'assets/';"
    )
  );
}

let ren = readFileSync(join(dir, 'payday-deck-renderer.js'), 'utf8');
if (!ren.includes('resolveDeckAsset')) {
  ren = ren.replace(
    '  function loadAssets(basePath, onProgress) {\n    basePath = basePath || \'../decks/\';',
    `  function resolveDeckAsset(basePath, src) {
    if (!src) return basePath;
    if (/^https?:\\/\\//i.test(src)) return src;
    const file = String(src).replace(/^(\\.\\.\\/)?decks\\//, '');
    return String(basePath).replace(/\\/?$/, '/') + file;
  }

  function loadAssets(basePath, onProgress) {
    basePath =
      basePath ||
      (typeof global !== 'undefined' && global.PAYDAY_PATHS && global.PAYDAY_PATHS.decksBase) ||
      '../decks/';`
  );
  ren = ren.replace(
    "logo.src = basePath + 'payday_logo_aligned.png';",
    "logo.src = resolveDeckAsset(basePath, 'payday_logo_aligned.png');"
  );
  ren = ren.replace(
    'img.src = ill.src.startsWith(\'.\') ? ill.src : basePath + ill.src;',
    'img.src = resolveDeckAsset(basePath, ill.src);'
  );
  writeFileSync(join(dir, 'payday-deck-renderer.js'), ren);
}

let app = readFileSync(join(dir, 'payday-deck-shop-app.js'), 'utf8');
app = app.replace(
  /if \(navCfg\) navCfg\.href = appendDevQuery\(navCfg\.getAttribute\('href'\)[^;]+;/,
  `if (navCfg) {
      const editorHref =
        (window.PAYDAY_PATHS && window.PAYDAY_PATHS.editorUrl) || navCfg.getAttribute('href') || '../decks/editor.html';
      navCfg.href = appendDevQuery(editorHref);
    }`
);
app = app.replace(
  "R.loadAssets('../decks/', onAssetProgress),",
  `R.loadAssets(
        (window.PAYDAY_PATHS && window.PAYDAY_PATHS.decksBase) || '../decks/',
        onAssetProgress
      ),`
);
writeFileSync(join(dir, 'payday-deck-shop-app.js'), app);
