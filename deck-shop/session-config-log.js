/**
 * Konfigurationshistorie — localStorage + Supabase (letzte 15 + Top global)
 */
(function (global) {
  const LOG_KEY_PREFIX = 'payday_config_log_v1_';
  const MAX = 15;

  function getSessionId() {
    try {
      return global.PAYDAY_RESERVATIONS?.getSessionId?.() || sessionStorage.getItem('payday_reserve_session_id') || 'anonymous';
    } catch {
      return 'anonymous';
    }
  }

  function apiBase() {
    const shop = global.PAYDAY_SHOP || {};
    return (shop.reservationApiUrl || '').replace(/\/$/, '');
  }

  function storageKey() {
    return LOG_KEY_PREFIX + getSessionId();
  }

  function readLocalLog() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeLocalLog(entries) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(entries.slice(0, MAX)));
    } catch {
      /* quota */
    }
  }

  function payloadFromEntry(entry) {
    return {
      design: entry.design ?? null,
      size: entry.size ?? null,
      cart: entry.cart ?? null,
      label: entry.label ?? null,
    };
  }

  async function syncRecordToServer(entry) {
    const base = apiBase();
    if (!base || !global.PAYDAY_RESERVATIONS?.isEnabled?.()) return;
    const sessionId = getSessionId();
    try {
      await fetch(`${base}/v1/config/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          source: entry.source || (entry.label === 'Editor' ? 'editor' : 'shop'),
          label: [entry.label, entry.design, entry.size, entry.cart].filter(Boolean).join(' · ') || 'Konfiguration',
          payload: payloadFromEntry(entry),
        }),
      });
    } catch {
      /* offline */
    }
  }

  function push(entry) {
    const list = readLocalLog();
    const row = {
      at: new Date().toISOString(),
      source: entry.source || 'shop',
      ...entry,
    };
    const dedupeKey = JSON.stringify(payloadFromEntry(row));
    const filtered = list.filter((x) => JSON.stringify(payloadFromEntry(x)) !== dedupeKey);
    filtered.unshift(row);
    writeLocalLog(filtered);
    syncRecordToServer(row);
    return filtered;
  }

  async function fetchServerHistory() {
    const base = apiBase();
    if (!base || !global.PAYDAY_RESERVATIONS?.isEnabled?.()) return null;
    const sessionId = getSessionId();
    try {
      const res = await fetch(
        `${base}/v1/config/history?sessionId=${encodeURIComponent(sessionId)}`,
        { credentials: 'omit' }
      );
      const json = await res.json().catch(() => ({}));
      return res.ok && json.ok ? json : null;
    } catch {
      return null;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatRow(row) {
    const t = row.at ? new Date(row.at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : '—';
    const label =
      row.label ||
      [row.design, row.size, row.cart].filter(Boolean).join(' · ') ||
      (row.payload && [row.payload.design, row.payload.size, row.payload.cart].filter(Boolean).join(' · ')) ||
      'Konfiguration';
    return `<li><time>${escapeHtml(t)}</time> ${escapeHtml(label)}</li>`;
  }

  async function renderList(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const sid = getSessionId();
    const server = await fetchServerHistory();
    const local = readLocalLog();

    let html = `<p class="config-log__sid">Session: <code>${escapeHtml(sid)}</code></p>`;

    if (server?.topGlobal?.label) {
      html += `<p class="config-log__top"><strong>Am häufigsten (global):</strong> ${escapeHtml(server.topGlobal.label)} · ${server.topGlobal.hitCount}×</p>`;
    }

    const recent = server?.recent?.length
      ? server.recent.map((r) =>
          formatRow({
            at: r.at,
            label: r.label,
            design: r.payload?.design,
            size: r.payload?.size,
            cart: r.payload?.cart,
          })
        )
      : local.map((r) => formatRow(r));

    if (!recent.length) {
      html += '<p class="config-log__empty">Noch keine Einträge.</p>';
    } else {
      html += `<ul class="config-log__list">${recent.join('')}</ul>`;
      if (!server?.recent?.length) {
        html += '<p class="config-log__empty">Nur lokal — Sync wenn Reservierungs-API aktiv.</p>';
      }
    }

    el.innerHTML = html;
  }

  global.PAYDAY_CONFIG_LOG = {
    getSessionId,
    push,
    renderList,
    readLog: readLocalLog,
    fetchServerHistory,
  };
})(window);
