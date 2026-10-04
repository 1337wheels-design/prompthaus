#!/usr/bin/env node
/**
 * Vercel GitHub App + Projekt „payday“ — Setup-Hilfe.
 *
 * Die GitHub App kann nur im Browser mit deinem Account installiert werden.
 * Optional: VERCEL_TOKEN in der Umgebung → Link + Production-Deploy aus der CLI.
 *
 * Usage:
 *   node scripts/vercel-setup.mjs
 *   VERCEL_TOKEN=… node scripts/vercel-setup.mjs --deploy
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

const REPO = '1337wheels-design/prompthaus';
const GITHUB_OWNER_ID = '262473948';
/** Vercel default; gh-pages bleibt für GitHub Pages. */
const PRODUCTION_BRANCH = process.env.VERCEL_PRODUCTION_BRANCH || 'main';
const PROJECT_NAME = 'payday';
const SHOP_URL =
  process.env.VERCEL_DECK_SHOP_URL ||
  'https://1337wheels-design-payday.vercel.app/deck-shop/';

const INSTALL_APP =
  `https://github.com/apps/vercel/installations/new/permissions` +
  `?target_id=${GITHUB_OWNER_ID}&target_type=User`;

const IMPORT_PROJECT =
  `https://vercel.com/new/clone?` +
  `repository-url=${encodeURIComponent(`https://github.com/${REPO}`)}` +
  `&project-name=${PROJECT_NAME}` +
  `&production-branch=${PRODUCTION_BRANCH}`;

const deploy = process.argv.includes('--deploy');
const token = process.env.VERCEL_TOKEN?.trim();

console.log(`
=== Vercel Setup — ${REPO} ===

1) GitHub App installieren (einmalig):
   ${INSTALL_APP}
   → Repository „${REPO}" auswählen (oder All repositories).

2) Projekt importieren / verbinden:
   ${IMPORT_PROJECT}
   Einstellungen:
   • Framework Preset: Other
   • Root Directory: . (Repo-Root)
   • Build Command: leer
   • Output: static (vercel.json)
   • Production Branch: ${PRODUCTION_BRANCH}

3) Nach Deploy prüfen:
   curl -I ${SHOP_URL}
   npm run test:go-live:vercel

--- Projekt „payday“ existiert schon / Git beim Erstellen nicht verbunden ---

Deck Shop liegt auf main (Merge aus gh-pages). GitHub Pages kann weiter gh-pages nutzen (beide Branches sync).

Dashboard: Projekt payday → Settings → Git → Repository verbinden
         → Settings → Environments → Production → Branch: ${PRODUCTION_BRANCH}
         → Deployments → Redeploy

Oder GitHub Action: .github/workflows/vercel-gh-pages.yml + Secrets VERCEL_* (siehe docs/vercel-deck-shop.md)

Doku: docs/vercel-deck-shop.md
`);

if (!token) {
  console.log(
    'Hinweis: Setze VERCEL_TOKEN (Vercel → Settings → Tokens) für CLI-Link/Deploy:\n' +
      '  VERCEL_TOKEN=… node scripts/vercel-setup.mjs --deploy\n'
  );
  process.exit(0);
}

const vercelBin = existsSync('node_modules/.bin/vercel')
  ? 'node_modules/.bin/vercel'
  : 'npx';
const vercelArgs = (sub) =>
  vercelBin === 'npx' ? ['vercel', ...sub] : sub;

console.log('VERCEL_TOKEN gesetzt — vercel whoami …');
const who = spawnSync(vercelBin, vercelArgs(['whoami']), {
  encoding: 'utf8',
  env: { ...process.env, VERCEL_TOKEN: token },
});
if (who.status !== 0) {
  console.error(who.stderr || who.stdout);
  process.exit(1);
}
console.log((who.stdout || '').trim());

console.log('\nvercel link (Projekt payday, scope aus Token) …');
const link = spawnSync(
  vercelBin,
  vercelArgs([
    'link',
    '--yes',
    '--project',
    PROJECT_NAME,
  ]),
  {
    encoding: 'utf8',
    env: { ...process.env, VERCEL_TOKEN: token },
    stdio: 'inherit',
  }
);
if (link.status !== 0) {
  console.error(
    '\nLink fehlgeschlagen — Projekt ggf. zuerst im Dashboard anlegen (Schritt 2).'
  );
  process.exit(link.status ?? 1);
}

if (!deploy) {
  console.log('\nLink OK. Deploy mit: VERCEL_TOKEN=… node scripts/vercel-setup.mjs --deploy');
  process.exit(0);
}

console.log('\nvercel deploy --prod …');
const dep = spawnSync(
  vercelBin,
  vercelArgs(['deploy', '--prod', '--yes']),
  {
    encoding: 'utf8',
    env: { ...process.env, VERCEL_TOKEN: token },
    stdio: 'inherit',
  }
);
process.exit(dep.status ?? 1);
