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
    config: { presence: { key: `client-${crypto.randomUUID()}` } }
  })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'wedding_quiz_sessions',
      filter: `id=eq.${sessionId}`
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'wedding_quiz_players',
      filter: `session_id=eq.${sessionId}`
    }, onChange)
    .on('presence', { event: 'sync' }, () => onPresence(channel.presenceState()));

  return channel;
}
