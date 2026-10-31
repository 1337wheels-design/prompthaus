#!/usr/bin/env node
/** Kopiert deck-shop JS/CSS in shopify/theme/assets (Payday Shop Theme). */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const root = new URL('..', import.meta.url).pathname;
const themeAssets = `${root}/shopify/theme/assets`;
const deckShop = `${root}/deck-shop`;

mkdirSync(themeAssets, { recursive: true });

const copies = [
  ['deck-shop.css', 'payday-deck-shop.css'],
  ['deck-inventory.js', 'payday-deck-inventory.js'],
  ['deck-renderer.js', 'payday-deck-renderer.js'],
  ['deck-reservations.js', 'payday-deck-reservations.js'],
  ['session-config-log.js', 'payday-session-config-log.js'],
  ['dev-vitals.js', 'payday-dev-vitals.js'],
  ['shopify-connect.js', 'payday-shopify-connect.js'],
  ['shopify-storefront-catalog.js', 'payday-shopify-storefront-catalog.js'],
  ['shopify-checkout.js', 'payday-shopify-checkout.js'],
];

for (const [src, dest] of copies) {
  cpSync(`${deckShop}/${src}`, `${themeAssets}/${dest}`);
}

const index = readFileSync(`${deckShop}/index.html`, 'utf8');
const lines = index.split('\n');
let shell = lines.slice(8, 192).join('\n');
shell = shell.replace(/^\s*<style>\s*/i, '').replace(/\s*<\/style>\s*$/i, '');
shell = shell.replace(/^    /gm, '');
writeFileSync(`${themeAssets}/payday-deck-shop-shell.css`, shell);

let app = lines.slice(340, 1490).join('\n');
app = app.replace(/^\s*<script>\s*\n/, '(function () {\n');
if (!app.trimEnd().endsWith('})();')) {
  app = app.replace(/\s*<\/script>\s*$/, '\n})();\n');
}
writeFileSync(`${themeAssets}/payday-deck-shop-app.js`, app);

const patches = spawnSync('node', [`${root}/scripts/patch-payday-theme-assets.mjs`], { stdio: 'inherit' });
if (patches.status !== 0) process.exit(patches.status ?? 1);

console.log('Synced deck-shop → shopify/theme/assets (Payday Shop theme)');
