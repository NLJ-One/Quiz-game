create or replace function public.wedding_quiz_animation_state(p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, auth
as $$
declare
  v_session public.wedding_quiz_sessions%rowtype;
  v_owner_id uuid;
  v_player_id uuid;
  v_question_position integer;
  v_completed_count integer := 0;
  v_streak integer := 0;
  v_answer_id text;
  v_score integer;
  v_awarded_points integer := 0;
  v_leaderboard jsonb;
begin
  select * into v_session
  from public.wedding_quiz_sessions
  where id = (p_payload ->> 'session_id')::uuid;
  if not found then
    raise exception 'Partie introuvable.';
  end if;

  select owner_id into v_owner_id
  from private.wedding_quiz_owner
  where singleton = true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', player.id,
    'pseudo', player.pseudo,
    'avatarIndex', player.avatar_index,
    'score', secret.score
  ) order by secret.score desc, player.joined_at asc, player.id asc), '[]'::jsonb)
  into v_leaderboard
  from public.wedding_quiz_players player
  join private.wedding_quiz_player_secrets secret
    on secret.player_id = player.id and secret.session_id = player.session_id
  where player.session_id = v_session.id;

  if auth.uid() is not null
    and auth.uid() = v_session.owner_id
    and auth.uid() = v_owner_id then
    return jsonb_build_object(
      'finishedAt', case when v_session.status = 'finished' then v_session.updated_at end,
      'elapsedMs', case when v_session.status = 'finished'
        then greatest(0, floor(extract(epoch from (clock_timestamp() - v_session.updated_at)) * 1000)::integer)
        else null end,
      'leaderboard', v_leaderboard
    );
  end if;

  select player.id into v_player_id
  from public.wedding_quiz_players player
  join private.wedding_quiz_player_secrets secret
    on secret.player_id = player.id and secret.session_id = player.session_id
  where player.id = (p_payload ->> 'player_id')::uuid
    and player.session_id = v_session.id
    and secret.token_hash = extensions.digest(
      convert_to(coalesce(p_payload ->> 'token', ''), 'UTF8'), 'sha256'
    );
  if not found then
    raise exception 'Session joueur invalide. Rejoins la partie à nouveau.';
  end if;

  select secret.score into v_score
  from private.wedding_quiz_player_secrets secret
  where secret.player_id = v_player_id and secret.session_id = v_session.id;

  v_question_position := array_position(v_session.question_order, v_session.current_question);
  if v_question_position is not null then
    v_completed_count := greatest(0, v_question_position - 1);
    if v_session.status = 'finished'
      or (v_session.status <> 'waiting' and not v_session.question_open)
      or (v_session.status = 'playing'
        and v_session.question_ends_at <= clock_timestamp()) then
      v_completed_count := v_question_position;
    end if;
  end if;

  select count(*)::integer into v_streak
  from (
    select
      sum(case when coalesce(answer.is_correct, false) then 0 else 1 end)
        over (order by question.ordinality desc) as breaks
    from unnest(v_session.question_order) with ordinality as question(question_index, ordinality)
    left join private.wedding_quiz_answers answer
      on answer.session_id = v_session.id
      and answer.player_id = v_player_id
      and answer.question_index = question.question_index
    where question.ordinality <= v_completed_count
  ) results
  where results.breaks = 0;

  if v_completed_count >= coalesce(v_question_position, 0) and v_question_position is not null then
    select answer.answer_id into v_answer_id
    from private.wedding_quiz_answers answer
    where answer.session_id = v_session.id
      and answer.player_id = v_player_id
      and answer.question_index = v_session.current_question;
    select answer.awarded_points into v_awarded_points
    from private.wedding_quiz_answers answer
    where answer.session_id = v_session.id
      and answer.player_id = v_player_id
      and answer.question_index = v_session.current_question;
  end if;

  return jsonb_build_object(
    'streak', v_streak,
    'answerId', v_answer_id,
    'score', v_score,
    'awardedPoints', v_awarded_points,
    'finishedAt', case when v_session.status = 'finished' then v_session.updated_at end,
    'elapsedMs', case when v_session.status = 'finished'
      then greatest(0, floor(extract(epoch from (clock_timestamp() - v_session.updated_at)) * 1000)::integer)
      else null end,
    'leaderboard', case
      when v_session.status = 'finished' or v_session.leaderboard_visible
        then v_leaderboard
      else null
    end
  );
end;
$$;

revoke all on function public.wedding_quiz_animation_state(jsonb) from public;
grant execute on function public.wedding_quiz_animation_state(jsonb) to anon, authenticated;
