/**
 * Browser client — 5-Min-Holds via deck-reservation-server
 */
(function (global) {
  const SESSION_KEY = 'payday_reserve_session_id';
  const DEFAULT_TTL_MS = 5 * 60 * 1000;

  function isLocalDevHost() {
    try {
      const h = global.location?.hostname || '';
      return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
    } catch {
      return false;
    }
  }

  function getConfig() {
    const shop = global.PAYDAY_SHOP || {};
    const params = new URLSearchParams(global.location?.search || '');
    const fromQuery = isLocalDevHost()
      ? params.get('reserveApi') || params.get('reservationApi')
      : null;
    const apiBase = (fromQuery || shop.reservationApiUrl || '').replace(/\/$/, '');
    return {
      apiBase,
      enabled: Boolean(apiBase),
      ttlMs: shop.reservationTtlMs || DEFAULT_TTL_MS,
      availabilityPollMs: shop.availabilityPollMs || 75 * 1000,
    };
  }

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id =
          (global.crypto?.randomUUID && crypto.randomUUID()) ||
          `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function cartToLines(cart) {
    const counts = new Map();
    (cart || []).forEach((item) => {
      if (!item?.id) return;
      counts.set(item.id, (counts.get(item.id) || 0) + 1);
    });
    return [...counts.entries()].map(([skuId, qty]) => ({ skuId, qty }));
  }

  async function request(path, body) {
    const cfg = getConfig();
    if (!cfg.apiBase) throw new Error('reservation_api_not_configured');
    const res = await fetch(`${cfg.apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 429) {
      return {
        status: res.status,
        ok: false,
        reason: json.reason || 'rate_limited',
        retryAfterSeconds: json.retryAfterSeconds,
        ...json,
      };
    }
    return { status: res.status, ...json };
  }

  async function fetchAvailability() {
    const cfg = getConfig();
    if (!cfg.apiBase) return { ok: false, reason: 'disabled' };
    const sessionId = getSessionId();
    const res = await fetch(
      `${cfg.apiBase}/v1/availability?sessionId=${encodeURIComponent(sessionId)}`,
      { credentials: 'omit' }
    );
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  }

  let heartbeatTimer = null;
  let availabilityPollTimer = null;
  let availabilityPollBackoffUntil = 0;
  let availabilityPollVisHook = null;

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat(getCart) {
    stopHeartbeat();
    const cfg = getConfig();
    if (!cfg.enabled) return;
    const intervalMs = Math.min(120000, Math.max(30000, Math.floor(cfg.ttlMs / 4)));
    heartbeatTimer = setInterval(async () => {
      const cart = typeof getCart === 'function' ? getCart() : [];
      if (!cart.length) {
        stopHeartbeat();
        return;
      }
      try {
        const sessionId = getSessionId();
        const lines = cartToLines(cart);
        const res = await request('/v1/cart/heartbeat', { sessionId, lines });
        if (res.ok && res.availability) {
          global.dispatchEvent(
            new CustomEvent('payday-reservation-updated', { detail: { availability: res.availability } })
          );
        }
      } catch {
        /* ignore */
      }
    }, intervalMs);
  }

  async function syncCart(cart) {
    const cfg = getConfig();
    if (!cfg.enabled) return { ok: true, disabled: true };
    const sessionId = getSessionId();
    const lines = cartToLines(cart);
    const res = await request('/v1/cart/sync', { sessionId, lines });
    if (res.ok && res.availability) {
      global.dispatchEvent(
        new CustomEvent('payday-reservation-updated', { detail: { availability: res.availability } })
      );
    }
    return res;
  }

  function stopAvailabilityPolling() {
    if (availabilityPollTimer) {
      clearInterval(availabilityPollTimer);
      availabilityPollTimer = null;
    }
    if (availabilityPollVisHook) {
      document.removeEventListener('visibilitychange', availabilityPollVisHook);
      availabilityPollVisHook = null;
    }
  }

  /** Stufe A — globale Holds/Basisbestand nach shop-sync-Cron im UI nachziehen. */
  function startAvailabilityPolling(options) {
    stopAvailabilityPolling();
    const cfg = getConfig();
    if (!cfg.enabled) return;
    const intervalMs = Math.max(45000, options?.intervalMs ?? cfg.availabilityPollMs ?? 75000);
    const isActive =
      typeof options?.isActive === 'function' ? options.isActive : () => true;

    const tick = async () => {
      if (Date.now() < availabilityPollBackoffUntil) return;
      if (!isActive()) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await fetchAvailability();
        if (res.ok && res.availability) {
          global.dispatchEvent(
            new CustomEvent('payday-reservation-updated', {
              detail: { availability: res.availability, source: 'poll' },
            })
          );
        } else if (res.status === 429 || res.reason === 'rate_limited') {
          const sec = Number(res.retryAfterSeconds) || 60;
          availabilityPollBackoffUntil = Date.now() + sec * 1000;
        }
      } catch {
        /* ignore */
      }
    };

    availabilityPollTimer = setInterval(tick, intervalMs);
    availabilityPollVisHook = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', availabilityPollVisHook);
    tick();
  }

  async function releaseCart() {
    const cfg = getConfig();
    if (!cfg.enabled) return { ok: true, disabled: true };
    stopHeartbeat();
    const sessionId = getSessionId();
    const res = await request('/v1/cart/release', { sessionId });
    if (res.ok && res.availability) {
      global.dispatchEvent(
        new CustomEvent('payday-reservation-updated', { detail: { availability: res.availability } })
      );
    }
    return res;
  }

  global.PAYDAY_RESERVATIONS = {
    getConfig,
    isEnabled: () => getConfig().enabled,
    getSessionId,
    cartToLines,
    fetchAvailability,
    syncCart,
    releaseCart,
    startHeartbeat,
    stopHeartbeat,
    startAvailabilityPolling,
    stopAvailabilityPolling,
  };
})(window);
