#!/usr/bin/env node
/**
 * Production-Deploy für Vercel-Projekt „payday“ (Team 1337wheels-design).
 *
 * Priorität:
 * 1. VERCEL_DEPLOY_HOOK_URL — POST (ein Secret, im Vercel-Dashboard anlegbar)
 * 2. VERCEL_TOKEN + VERCEL_ORG_ID + VERCEL_PROJECT_ID — CLI
 * 3. Fallback: anonymes --temporary Deploy + Claim-URL (60 min gültig)
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

const hook = process.env.VERCEL_DEPLOY_HOOK_URL?.trim();
const token = process.env.VERCEL_TOKEN?.trim();
const orgId = process.env.VERCEL_ORG_ID?.trim();
const projectId = process.env.VERCEL_PROJECT_ID?.trim();

async function postHook() {
  const res = await fetch(hook, { method: 'POST' });
  const text = await res.text();
  if (!res.ok) {
    console.error('Deploy Hook failed:', res.status, text);
    process.exit(1);
  }
  console.log('Deploy Hook triggered:', res.status, text || '(ok)');
}

function cliDeploy() {
  const bin = existsSync('node_modules/.bin/vercel')
    ? 'node_modules/.bin/vercel'
    : 'npx';
  const args =
    bin === 'npx'
      ? ['vercel', 'deploy', '--prod', '--yes', '--token', token]
      : ['deploy', '--prod', '--yes', '--token', token];
  const r = spawnSync(bin, args, {
    stdio: 'inherit',
    env: { ...process.env, VERCEL_TOKEN: token, VERCEL_ORG_ID: orgId, VERCEL_PROJECT_ID: projectId },
    cwd: process.cwd(),
  });
  process.exit(r.status ?? 1);
}

function temporaryDeploy() {
  console.log('Kein Hook/Token — anonymes Temporary-Deploy (Repo-Stand, deck-shop/ ok)…');
  const bin = existsSync('node_modules/.bin/vercel') ? 'node_modules/.bin/vercel' : 'npx';
  const args = bin === 'npx' ? ['vercel', 'deploy', '--temporary', '--yes'] : ['deploy', '--temporary', '--yes'];
  const r = spawnSync(bin, args, { encoding: 'utf8', cwd: process.cwd() });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) process.exit(r.status ?? 1);
  try {
    const j = JSON.parse(r.stdout);
    console.log('\n--- Claim (→ Vercel-Account, dann Projekt payday zuweisen) ---');
    console.log(j.message || j.deployment?.claimUrl);
    if (j.deployment?.url) {
      console.log('\nTest:', j.deployment.url + '/deck-shop/');
    }
  } catch {
    console.log(r.stdout);
  }
}

if (hook) {
  await postHook();
  process.exit(0);
}

if (token && orgId && projectId) {
  cliDeploy();
}

if (process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true') {
  console.warn(
    'CI: Kein VERCEL_DEPLOY_HOOK_URL oder VERCEL_TOKEN/ORG/PROJECT — Deploy übersprungen.'
  );
  process.exit(0);
}

temporaryDeploy();
