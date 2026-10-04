/**
 * In-memory SKU holds per browser session (TTL). Used by deck-reservation-server + tests.
 */

export const DEFAULT_TTL_MS = 5 * 60 * 1000;

function sessionSkuKey(sessionId, skuId) {
  return `${sessionId}\u0000${skuId}`;
}

function aggregateLines(lines) {
  const map = new Map();
  for (const line of lines || []) {
    const skuId = line?.skuId;
    const qty = Math.max(0, Number(line?.qty) || 0);
    if (!skuId || qty === 0) continue;
    map.set(skuId, (map.get(skuId) || 0) + qty);
  }
  return map;
}

export class DeckReservationStore {
  /**
   * @param {Record<string, number>} baseStock
   * @param {number} [ttlMs]
   */
  constructor(baseStock, ttlMs = DEFAULT_TTL_MS) {
    this.baseStock = { ...baseStock };
    this.ttlMs = ttlMs;
    /** @type {Map<string, { qty: number, expiresAt: number }>} */
    this.holds = new Map();
  }

  purge(now = Date.now()) {
    for (const [key, hold] of this.holds) {
      if (hold.expiresAt <= now) this.holds.delete(key);
    }
  }

  /** @param {string} [exceptSessionId] */
  heldQty(skuId, now = Date.now(), exceptSessionId = null) {
    this.purge(now);
    let sum = 0;
    for (const [key, hold] of this.holds) {
      const sep = key.indexOf('\u0000');
      const sid = key.slice(0, sep);
      const sku = key.slice(sep + 1);
      if (sku !== skuId) continue;
      if (exceptSessionId && sid === exceptSessionId) continue;
      sum += hold.qty;
    }
    return sum;
  }

  sessionHeldQty(sessionId, skuId, now = Date.now()) {
    this.purge(now);
    return this.holds.get(sessionSkuKey(sessionId, skuId))?.qty || 0;
  }

  clearSession(sessionId) {
    for (const key of [...this.holds.keys()]) {
      if (key.startsWith(sessionId + '\u0000')) this.holds.delete(key);
    }
  }

  touchSession(sessionId, now = Date.now()) {
    const expiresAt = now + this.ttlMs;
    for (const [key, hold] of this.holds) {
      if (key.startsWith(sessionId + '\u0000')) hold.expiresAt = expiresAt;
    }
  }

  /**
   * @param {string} sessionId
   * @param {{ skuId: string, qty?: number }[]} lines
   */
  syncSession(sessionId, lines, now = Date.now()) {
    this.purge(now);
    if (!sessionId || typeof sessionId !== 'string') {
      return { ok: false, reason: 'invalid_session' };
    }

    const wanted = aggregateLines(lines);
    this.clearSession(sessionId);

    for (const [skuId, qty] of wanted) {
      const base = this.baseStock[skuId];
      if (base == null) {
        return { ok: false, reason: 'unknown_sku', skuId };
      }
      const others = this.heldQty(skuId, now);
      if (others + qty > base) {
        return {
          ok: false,
          reason: 'insufficient',
          skuId,
          available: Math.max(0, base - others),
          requested: qty,
        };
      }
    }

    const expiresAt = now + this.ttlMs;
    for (const [skuId, qty] of wanted) {
      this.holds.set(sessionSkuKey(sessionId, skuId), { qty, expiresAt });
    }

    return {
      ok: true,
      ttlMs: this.ttlMs,
      expiresAt,
      availability: this.getAvailability(sessionId, now),
    };
  }

  getAvailability(_sessionId, now = Date.now()) {
    this.purge(now);
    const out = {};
    for (const [skuId, base] of Object.entries(this.baseStock)) {
      const held = this.heldQty(skuId, now);
      out[skuId] = Math.max(0, base - held);
    }
    return out;
  }

  setBaseStock(next) {
    this.baseStock = { ...next };
  }
}
