/**
 * Infrastruktur-Vitals (pollbar) — nur mit ?dev=1
 */
(function (global) {
  const RES =
    'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api';
  const SYNC = 'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/shop-sync';
  const FALLBACK_ORIGIN = 'https://1337wheels-design.github.io';
  const PROBE_ORIGIN = (function () {
    try {
      if (global.location?.origin) return global.location.origin;
    } catch {
      /* ignore */
    }
    return FALLBACK_ORIGIN;
  })();
  const SHOPIFY = 'xwk1u9-6z.myshopify.com';
  const PAGES_SHOP = (function () {
    try {
      const m = global.location.pathname.match(/^(.*\/deck-shop\/)/);
      if (m) return global.location.origin + m[1];
    } catch {
      /* ignore */
    }
    return new URL('./', global.location.href).href;
  })();

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  }

  async function probe(name, fn) {
    try {
      const data = await fn();
      return { name, ok: true, ...data };
    } catch (e) {
      return { name, ok: false, error: String(e.message || e) };
    }
  }

  async function fetchSnapshot() {
    const panels = [];
    panels.push(
      await probe('reservation', async () => {
        const h = await fetch(`${RES}/health`, { headers: { Origin: PROBE_ORIGIN } }).then((r) =>
          r.json()
        );
        const a = await fetch(`${RES}/v1/availability?sessionId=dev-vitals`, {
          headers: { Origin: PROBE_ORIGIN },
        }).then((r) => r.json());
        const av = a.availability || {};
        return {
          rateLimit: h.rateLimit,
          rateLimitDb: h.rateLimitDb?.ok,
          totalAvail: Object.values(av).reduce((s, n) => s + (Number(n) || 0), 0),
          chrome838: av['chrome-838'],
        };
      })
    );
    panels.push(
      await probe('shop_sync', async () => {
        const h = await fetch(`${SYNC}/health`, { headers: { Origin: PROBE_ORIGIN } }).then((r) =>
          r.json()
        );
        return { configured: h.configured, checks: h.checks };
      })
    );
    panels.push(
      await probe('pages', async () => {
        const r = await fetch(PAGES_SHOP, { method: 'HEAD' });
        return { http: r.status };
      })
    );
    panels.push(
      await probe('shopify', async () => {
        try {
          const r = await fetch(`https://${SHOPIFY}/`, { mode: 'no-cors' });
          return { note: 'Browser-CORS — siehe Snapshot', opaque: r.type === 'opaque' };
        } catch (e) {
          return { note: 'nur CLI/Snapshot', error: String(e.message) };
        }
      })
    );
    let snap = null;
    try {
      snap = await fetch(new URL('snapshot.json', new URL('../deck-report/', global.location.href))).then((r) =>
        r.ok ? r.json() : null
      );
    } catch {
      /* ignore */
    }
    const degraded = panels.some((p) => p.ok === false);
    return { at: new Date().toISOString(), overall: degraded ? 'degraded' : 'ok', panels, reportSnapshot: snap };
  }

  function renderPanel(root, data) {
    const rows = data.panels
      .map((p) => {
        if (!p.ok) {
          return `<tr><td>${esc(p.name)}</td><td colspan="2" style="color:#f87171">FAIL ${esc(p.error)}</td></tr>`;
        }
        if (p.name === 'reservation') {
          return `<tr><td>Supabase Reservierung</td><td>${esc(p.rateLimit)}</td><td>${p.totalAvail} frei · chrome-838: ${p.chrome838 ?? '—'}</td></tr>`;
        }
        if (p.name === 'shop_sync') {
          return `<tr><td>Shop-Sync</td><td>${p.configured ? 'OK' : '—'}</td><td>${p.checks ? esc(JSON.stringify(p.checks)) : ''}</td></tr>`;
        }
        if (p.name === 'pages') {
          return `<tr><td>Deck Shop (Host)</td><td>${p.http}</td><td>HEAD ${esc(PAGES_SHOP)}</td></tr>`;
        }
        if (p.name === 'shopify') {
          return `<tr><td>Shopify</td><td>—</td><td>${esc(p.note || '')}</td></tr>`;
        }
        return `<tr><td>${esc(p.name)}</td><td>OK</td><td></td></tr>`;
      })
      .join('');

    const snapLine = data.reportSnapshot?.at
      ? `<p class="dev-vitals__meta">Report-Snapshot: ${esc(new Date(data.reportSnapshot.at).toLocaleString('de-DE'))} · ${esc(data.reportSnapshot.overall)}</p>`
      : '';

    root.innerHTML = `
      <div class="dev-vitals__head">
        <h2>Infrastruktur-Vitals</h2>
        <span class="dev-vitals__badge dev-vitals__badge--${data.overall === 'ok' ? 'ok' : 'warn'}">${esc(data.overall.toUpperCase())}</span>
        <button type="button" class="dev-vitals__refresh" id="dev-vitals-refresh">Aktualisieren</button>
      </div>
      <p class="dev-vitals__meta">Live: ${esc(new Date(data.at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }))} (Europe/Berlin)</p>
      ${snapLine}
      <table class="dev-vitals__table"><thead><tr><th>Service</th><th>Status</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="dev-vitals__links">
        <a href="../deck-report/?dev=1" target="_blank" rel="noopener">Ops-Bericht</a>
        <a href="../deck-report/profiles.html?dev=1" target="_blank" rel="noopener">Drop-Profile</a>
        <a href="https://supabase.com/dashboard/project/yoeehrdsrfwolzdtgmel/functions" target="_blank" rel="noopener">Supabase Logs</a>
        <a href="../?dev=1">Dev-Menü</a>
      </div>
    `;
    root.querySelector('#dev-vitals-refresh')?.addEventListener('click', () => mount(root, true));
  }

  async function mount(root, manual) {
    if (manual) root.classList.add('is-loading');
    const data = await fetchSnapshot();
    root.classList.remove('is-loading');
    renderPanel(root, data);
  }

  function init() {
    const root = document.getElementById('dev-vitals');
    if (!root) return;
    mount(root, false);
    setInterval(() => mount(root, false), 30_000);
  }

  global.PAYDAY_DEV_VITALS = { init, fetchSnapshot };
})(window);
