/**
 * Supabase Postgres backend (RPC) — gleiche API wie DeckReservationStore.
 */
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_TTL_MS } from './deck-reservation-store.mjs';

export function createSupabaseReservationBackend(options = {}) {
  const url = options.url || process.env.SUPABASE_URL;
  const key = options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  const ttlMs = options.ttlMs || Number(process.env.DECK_RESERVE_TTL_MS) || DEFAULT_TTL_MS;
  const ttlSec = Math.max(30, Math.floor(ttlMs / 1000));

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function rpc(name, params) {
    const { data, error } = await supabase.rpc(name, params);
    if (error) throw error;
    return data;
  }

  return {
    ttlMs,
    async getAvailability(_sessionId) {
      const data = await rpc('deck_availability', {});
      return typeof data === 'object' && data ? data : {};
    },
    async syncSession(sessionId, lines) {
      return rpc('deck_sync_cart', {
        p_session_id: sessionId,
        p_lines: lines,
        p_ttl_seconds: ttlSec,
      });
    },
    async clearSession(sessionId) {
      return rpc('deck_release_session', { p_session_id: sessionId });
    },
    async heartbeat(sessionId, lines) {
      return rpc('deck_heartbeat_cart', {
        p_session_id: sessionId,
        p_lines: lines,
        p_ttl_seconds: ttlSec,
      });
    },
  };
}
