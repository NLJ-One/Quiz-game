import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0?bundle';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '/js/supabase.config.js';

const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)
  && SUPABASE_ANON_KEY.length > 20
  && !SUPABASE_ANON_KEY.includes('YOUR-SUPABASE');

let client;

export function isSupabaseConfigured() {
  return configured;
}

export function getSupabase() {
  if (!configured) {
    throw new Error('Supabase n’est pas configuré. Renseigne son URL et sa clé anon dans /js/supabase.config.js.');
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 10 } }
    });
  }
  return client;
}

export async function weddingAction(action, payload = {}) {
  const { data, error } = await getSupabase().rpc('wedding_quiz_action', {
    p_action: action,
    p_payload: payload
  });
  if (error) throw new Error(error.message || 'La requête Supabase a échoué.');
  return data;
}

export function subscribeToWeddingGame(sessionId, onChange, onPresence) {
  const supabase = getSupabase();
  const channel = supabase.channel(`wedding-game:${sessionId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: crypto.randomUUID() }
    }
  })
    .on('broadcast', { event: 'state_changed' }, onChange)
    .on('presence', { event: 'sync' }, () => onPresence?.(channel.presenceState()));

  const ready = new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(status);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        reject(new Error(`La synchronisation temps réel a échoué (${status}).`));
      }
    });
  });
  return { channel, ready };
}

export async function notifyWeddingGame(sessionId) {
  const supabase = getSupabase();
  const channel = supabase.channel(`wedding-game:${sessionId}`, {
    config: { broadcast: { self: false } }
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Délai de connexion Realtime dépassé.')), 10000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve(status);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          reject(new Error(`La notification Realtime a échoué (${status}).`));
        }
      });
    });
    const result = await channel.send({
      type: 'broadcast',
      event: 'state_changed',
      payload: {}
    });
    if (result !== 'ok') throw new Error(`La notification Realtime a échoué (${result}).`);
  } finally {
    await supabase.removeChannel(channel);
  }
}
