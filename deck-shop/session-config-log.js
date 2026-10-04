/**
 * Letzte Konfigurationen pro Reservierungs-Session (localStorage)
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

  function storageKey() {
    return LOG_KEY_PREFIX + getSessionId();
  }

  function readLog() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeLog(entries) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(entries.slice(0, MAX)));
    } catch {
      /* quota */
    }
  }

  function push(entry) {
    const list = readLog();
    const row = {
      at: new Date().toISOString(),
      ...entry,
    };
    const dedupeKey = JSON.stringify({ design: row.design, size: row.size, cart: row.cart });
    const filtered = list.filter((x) => JSON.stringify({ design: x.design, size: x.size, cart: x.cart }) !== dedupeKey);
    filtered.unshift(row);
    writeLog(filtered);
    return filtered;
  }

  function renderList(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const sid = getSessionId();
    const list = readLog();
    if (!list.length) {
      el.innerHTML = `<p class="config-log__empty">Session <code>${escapeHtml(sid.slice(0, 24))}…</code> — noch keine Einträge.</p>`;
      return;
    }
    el.innerHTML =
      `<p class="config-log__sid">Session: <code>${escapeHtml(sid)}</code></p>` +
      '<ul class="config-log__list">' +
      list
        .map((row) => {
          const t = new Date(row.at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
          const label = [row.design, row.size, row.cart].filter(Boolean).join(' · ') || row.label || 'Konfiguration';
          return `<li><time>${escapeHtml(t)}</time> ${escapeHtml(label)}</li>`;
        })
        .join('') +
      '</ul>';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  global.PAYDAY_CONFIG_LOG = {
    getSessionId,
    push,
    renderList,
    readLog,
  };
})(window);
