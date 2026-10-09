create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists private.wedding_quiz_owner (
  singleton boolean primary key default true check (singleton),
  owner_id uuid references auth.users(id) on delete restrict
);

insert into private.wedding_quiz_owner (singleton, owner_id)
values (true, null)
on conflict (singleton) do nothing;

create table if not exists private.wedding_quiz_questions (
  position integer primary key check (position between 0 and 14),
  question text not null,
  choices jsonb not null check (jsonb_array_length(choices) = 4),
  correct_answer_id text not null check (correct_answer_id in ('A', 'B', 'C', 'D')),
  duration integer not null default 12 check (duration = 12),
  base_points integer not null default 150 check (base_points = 150),
  points_multiplier integer not null default 15 check (points_multiplier = 15)
);

create table if not exists public.wedding_quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null default 'Connaissez vous vraiment Chloé et Gilles',
  description text not null default 'On va voir si vos connaissez Gilles et Chloé.',
  code text not null unique check (code ~ '^[0-9]{6}$'),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'paused', 'finished')),
  current_question integer not null default -1 check (current_question between -1 and 14),
  question_order integer[] not null default '{}',
  answer_orders jsonb not null default '{}'::jsonb,
  question_open boolean not null default false,
  question_started_at timestamptz,
  question_ends_at timestamptz,
  remaining_ms integer,
  leaderboard_visible boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create unique index if not exists wedding_quiz_one_unfinished_session_per_owner
  on public.wedding_quiz_sessions (owner_id)
  where status <> 'finished';

create table if not exists public.wedding_quiz_players (
  id uuid primary key,
  session_id uuid not null references public.wedding_quiz_sessions(id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 2 and 20),
  avatar_index integer not null default 0 check (avatar_index between 0 and 39),
  joined_at timestamptz not null default clock_timestamp(),
  unique (session_id, id)
);

create unique index if not exists wedding_quiz_player_pseudo_unique
  on public.wedding_quiz_players (session_id, lower(pseudo));

create table if not exists private.wedding_quiz_player_secrets (
  player_id uuid primary key,
  session_id uuid not null references public.wedding_quiz_sessions(id) on delete cascade,
  token_hash bytea not null,
  score integer not null default 0 check (score >= 0),
  streak integer not null default 0 check (streak >= 0),
  unique (session_id, player_id),
  foreign key (session_id, player_id)
    references public.wedding_quiz_players(session_id, id) on delete cascade
);

create table if not exists private.wedding_quiz_answers (
  player_id uuid not null,
  session_id uuid not null,
  question_index integer not null check (question_index between 0 and 14),
  answer_id text not null check (answer_id in ('A', 'B', 'C', 'D')),
  submitted_at timestamptz not null default clock_timestamp(),
  is_correct boolean not null,
  awarded_points integer not null check (awarded_points >= 0),
  primary key (player_id, session_id, question_index),
  foreign key (session_id, player_id)
    references private.wedding_quiz_player_secrets(session_id, player_id) on delete cascade
);

alter table private.wedding_quiz_owner enable row level security;
alter table private.wedding_quiz_questions enable row level security;
alter table public.wedding_quiz_sessions enable row level security;
alter table public.wedding_quiz_players enable row level security;
alter table private.wedding_quiz_player_secrets enable row level security;
alter table private.wedding_quiz_answers enable row level security;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on public.wedding_quiz_sessions, public.wedding_quiz_players
  from public, anon, authenticated;

insert into private.wedding_quiz_questions
  (position, question, choices, correct_answer_id)
select q.position, q.question, q.choices, q.correct_answer_id
from jsonb_to_recordset(
  $questions$[
    {"position":0,"question":"La couleur préférée de Chloé ?","choices":[{"id":"A","text":"Bleu"},{"id":"B","text":"Vert"},{"id":"C","text":"Violet"},{"id":"D","text":"Orange"}],"correct_answer_id":"B"},
    {"position":1,"question":"Depuis combien de temps Gilles vit seul ?","choices":[{"id":"A","text":"10 ans"},{"id":"B","text":"5 ans"},{"id":"C","text":"8 ans"},{"id":"D","text":"3 ans"}],"correct_answer_id":"C"},
    {"position":2,"question":"En quelle année Gilles et Chloé se sont vues pour la première fois ?","choices":[{"id":"A","text":"2012"},{"id":"B","text":"2009"},{"id":"C","text":"2018"},{"id":"D","text":"2022"}],"correct_answer_id":"B"},
    {"position":3,"question":"Quel est le club de foot préféré de Gilles ?","choices":[{"id":"A","text":"Paris Saint Germain (PSG)"},{"id":"B","text":"FC Barçelone"},{"id":"C","text":"Olympique de Marseille"},{"id":"D","text":"Real Madrid"}],"correct_answer_id":"C"},
    {"position":4,"question":"Quels est le 2ième métier que Chloé aurait aimé pratiquer ?","choices":[{"id":"A","text":"Kinésithérapeute"},{"id":"B","text":"Psychologue"},{"id":"C","text":"Présidente"},{"id":"D","text":"Conseillère clientèle"}],"correct_answer_id":"A"},
    {"position":5,"question":"Quel est le premier film que les mariés sont allés voir ensemble au cinéma ?","choices":[{"id":"A","text":"Avatar"},{"id":"B","text":"Transformers"},{"id":"C","text":"Pat Patrouille"},{"id":"D","text":"Toy Story 5"}],"correct_answer_id":"A"},
    {"position":6,"question":"Quel est le genre de musique préféré de Gilles ?","choices":[{"id":"A","text":"Rock"},{"id":"B","text":"Hip Hop"},{"id":"C","text":"Musiques d'animés"},{"id":"D","text":"Jazz"}],"correct_answer_id":"C"},
    {"position":7,"question":"Quel sport pratiquait Chloé durant son enfance ?","choices":[{"id":"A","text":"Danse Modern'Jazz"},{"id":"B","text":"Breakdance"},{"id":"C","text":"Danse classique"},{"id":"D","text":"Salsa"}],"correct_answer_id":"A"},
    {"position":8,"question":"Combien de temps Gilles a t-il pris pour déclarer sa flamme ?","choices":[{"id":"A","text":"1 mois"},{"id":"B","text":"4 ans"},{"id":"C","text":"2 ans"},{"id":"D","text":"1 semaines"}],"correct_answer_id":"B"},
    {"position":9,"question":"Quel est le deuxième prénom de Gilles ?","choices":[{"id":"A","text":"Léonce"},{"id":"B","text":"Gildas"},{"id":"C","text":"Daniel"},{"id":"D","text":"Carglass"}],"correct_answer_id":"A"},
    {"position":10,"question":"Comment se nomme la chanteuse préférée de Chloé ?","choices":[{"id":"A","text":"Beyonce"},{"id":"B","text":"Sade"},{"id":"C","text":"Alicia Keys"},{"id":"D","text":"Whitney houston"}],"correct_answer_id":"C"},
    {"position":11,"question":"Quel point commun ont les mariés ?","choices":[{"id":"A","text":"Grincheux"},{"id":"B","text":"Têtus"},{"id":"C","text":"Retardataires"},{"id":"D","text":"Naïfs"}],"correct_answer_id":"B"},
    {"position":12,"question":"La première voiture que Gilles a acheté ?","choices":[{"id":"A","text":"Peugeot 407"},{"id":"B","text":"Ferrari"},{"id":"C","text":"Audi A1"},{"id":"D","text":"Ford Fiesta"}],"correct_answer_id":"A"},
    {"position":13,"question":"La première ville où Chloé a enseignée ?","choices":[{"id":"A","text":"Moissy"},{"id":"B","text":"Paris"},{"id":"C","text":"Sarcelle"},{"id":"D","text":"Sevra"}],"correct_answer_id":"C"},
    {"position":14,"question":"à partir de quelle mois Gilles et Chloé ont commencé à se fréquenter ?","choices":[{"id":"A","text":"Mai"},{"id":"B","text":"Janvier"},{"id":"C","text":"Mars"},{"id":"D","text":"Décembre"}],"correct_answer_id":"B"}
  ]$questions$::jsonb
) as q(position integer, question text, choices jsonb, correct_answer_id text)
on conflict (position) do nothing;

create or replace function private.wedding_quiz_question_payload(
  p_session_id uuid,
  p_position integer,
  p_reveal boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_question private.wedding_quiz_questions%rowtype;
  v_choices jsonb;
  v_order jsonb;
  v_result jsonb;
begin
  select * into v_question
  from private.wedding_quiz_questions
  where position = p_position;
  if not found then
    return null;
  end if;

  select answer_orders -> p_position::text into v_order
  from public.wedding_quiz_sessions
  where id = p_session_id;

  if jsonb_typeof(v_order) = 'array' then
    select jsonb_agg(choice.value order by ordered.ordinality)
    into v_choices
    from jsonb_array_elements(v_order) with ordinality as ordered(choice_id, ordinality)
    join jsonb_array_elements(v_question.choices) as choice(value)
      on choice.value ->> 'id' = ordered.choice_id #>> '{}';
  else
    select jsonb_agg(choice)
    into v_choices
    from jsonb_array_elements(v_question.choices) as choice;
  end if;

  v_result := jsonb_build_object(
    'position', v_question.position,
    'text', v_question.question,
    'choices', coalesce(v_choices, '[]'::jsonb),
    'duration', v_question.duration
  );
  if p_reveal then
    v_result := v_result || jsonb_build_object(
      'correctAnswerId', v_question.correct_answer_id
    );
  end if;
  return v_result;
end;
$$;

revoke all on function private.wedding_quiz_question_payload(uuid, integer, boolean)
  from public, anon, authenticated;

create or replace function public.wedding_quiz_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, auth
as $$
declare
  v_owner_id uuid;
  v_session public.wedding_quiz_sessions%rowtype;
  v_player public.wedding_quiz_players%rowtype;
  v_secret private.wedding_quiz_player_secrets%rowtype;
  v_question private.wedding_quiz_questions%rowtype;
  v_question_order integer[];
  v_answer_order jsonb;
  v_answer_orders jsonb := '{}'::jsonb;
  v_code text;
  v_token text;
  v_answer_id text;
  v_correct boolean;
  v_points integer;
  v_ratio numeric;
  v_order_position integer;
  v_players jsonb;
  v_leaderboard jsonb;
  v_reveal boolean;
  v_existing public.wedding_quiz_sessions%rowtype;
begin
  select owner_id into v_owner_id
  from private.wedding_quiz_owner
  where singleton = true;

  if p_action = 'lookup' then
    if coalesce(p_payload ->> 'code', '') !~ '^[0-9]{6}$' then
      return jsonb_build_object('found', false);
    end if;
    select * into v_session
    from public.wedding_quiz_sessions
    where code = p_payload ->> 'code';
    if not found then
      return jsonb_build_object('found', false);
    end if;
    return jsonb_build_object(
      'found', true, 'sessionId', v_session.id, 'title', v_session.title,
      'status', v_session.status, 'questionCount', 15, 'duration', 12
    );
  end if;

  if p_action in ('catalog', 'prepare') then
    if auth.uid() is null or v_owner_id is null or auth.uid() <> v_owner_id then
      raise exception 'Ce compte ne possède pas le quiz préenregistré.'
        using errcode = '42501';
    end if;
    if p_action = 'catalog' then
      select * into v_existing
      from public.wedding_quiz_sessions
      where owner_id = auth.uid()
      order by created_at desc
      limit 1;
      return jsonb_build_object(
        'quizId', 'chloe-gilles-wedding',
        'title', 'Connaissez vous vraiment Chloé et Gilles',
        'description', 'On va voir si vos connaissez Gilles et Chloé.',
        'questionCount', 15,
        'sessionId', v_existing.id,
        'code', v_existing.code,
        'status', v_existing.status
      );
    end if;

    perform 1 from private.wedding_quiz_owner where singleton = true for update;
    select * into v_existing
    from public.wedding_quiz_sessions
    where owner_id = auth.uid() and status <> 'finished'
    order by created_at desc
    limit 1;
    if found then
      return jsonb_build_object('sessionId', v_existing.id, 'code', v_existing.code, 'status', v_existing.status);
    end if;

    loop
      v_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
      exit when not exists (select 1 from public.wedding_quiz_sessions where code = v_code);
    end loop;
    insert into public.wedding_quiz_sessions (owner_id, code)
    values (auth.uid(), v_code)
    returning * into v_session;
    return jsonb_build_object('sessionId', v_session.id, 'code', v_session.code, 'status', v_session.status);
  end if;

  if p_action = 'join' then
    select * into v_session from public.wedding_quiz_sessions
    where code = p_payload ->> 'code' for update;
    if not found or v_session.status <> 'waiting' then
      raise exception 'Cette salle est introuvable ou n’accepte plus de nouveaux joueurs.';
    end if;
    if length(trim(coalesce(p_payload ->> 'pseudo', ''))) not between 2 and 20 then
      raise exception 'Le pseudo doit contenir entre 2 et 20 caractères.';
    end if;
    if coalesce((p_payload ->> 'avatar_index')::integer, -1) not between 0 and 39 then
      raise exception 'L’avatar sélectionné est invalide.';
    end if;
    if (select count(*) from public.wedding_quiz_players where session_id = v_session.id) >= 150 then
      raise exception 'Cette salle a atteint sa capacité maximale.';
    end if;

    v_player.id := gen_random_uuid();
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    begin
      insert into public.wedding_quiz_players (id, session_id, pseudo, avatar_index)
      values (
        v_player.id, v_session.id, trim(p_payload ->> 'pseudo'),
        (p_payload ->> 'avatar_index')::integer
      )
      returning * into v_player;
      insert into private.wedding_quiz_player_secrets (player_id, session_id, token_hash)
      values (
        v_player.id, v_session.id,
        extensions.digest(convert_to(v_token, 'UTF8'), 'sha256')
      );
    exception when unique_violation then
      raise exception 'Ce pseudo est déjà pris dans cette salle.';
    end;
    return jsonb_build_object(
      'joined', true, 'sessionId', v_session.id,
      'playerId', v_player.id, 'token', v_token
    );
  end if;

  if p_action in ('host_state', 'start', 'advance', 'pause', 'resume', 'finish', 'reset') then
    if auth.uid() is null then
      raise exception 'Authentification organisateur requise.' using errcode = '42501';
    end if;
    select * into v_session
    from public.wedding_quiz_sessions
    where id = (p_payload ->> 'session_id')::uuid
    for update;
    if not found or v_session.owner_id <> auth.uid() or v_owner_id <> auth.uid() then
      raise exception 'Seul le propriétaire authentifié peut contrôler cette partie.'
        using errcode = '42501';
    end if;
  elsif p_action in ('player_state', 'answer') then
    select * into v_session
    from public.wedding_quiz_sessions
    where id = (p_payload ->> 'session_id')::uuid;
    if not found then
      raise exception 'Partie introuvable.';
    end if;
    v_token := p_payload ->> 'token';
    select * into v_player
    from public.wedding_quiz_players
    where id = (p_payload ->> 'player_id')::uuid and session_id = v_session.id;
    if not found then
      raise exception 'Session joueur invalide. Rejoins la partie à nouveau.';
    end if;
    select * into v_secret
    from private.wedding_quiz_player_secrets
    where player_id = v_player.id and session_id = v_session.id
      and token_hash = extensions.digest(convert_to(coalesce(v_token, ''), 'UTF8'), 'sha256')
    for update;
    if not found then
      raise exception 'Session joueur invalide. Rejoins la partie à nouveau.';
    end if;
  else
    raise exception 'Action de partie inconnue.';
  end if;

  if p_action = 'start' then
    if v_session.status <> 'waiting' then
      raise exception 'Cette partie ne peut être lancée qu’une seule fois.';
    end if;
    select array_agg(position order by random()) into v_question_order
    from private.wedding_quiz_questions;
    for v_question in select * from private.wedding_quiz_questions loop
      select jsonb_agg(choice ->> 'id' order by random()) into v_answer_order
      from jsonb_array_elements(v_question.choices) as choices(choice);
      v_answer_orders := v_answer_orders
        || jsonb_build_object(v_question.position::text, v_answer_order);
    end loop;
    if coalesce(cardinality(v_question_order), 0) <> 15 then
      raise exception 'Les 15 questions du quiz ne sont pas installées.';
    end if;
    update public.wedding_quiz_sessions
    set question_order = v_question_order,
        answer_orders = v_answer_orders,
        status = 'playing',
        current_question = v_question_order[1],
        question_open = true,
        question_started_at = clock_timestamp(),
        question_ends_at = clock_timestamp() + interval '12 seconds',
        remaining_ms = null,
        leaderboard_visible = false,
        updated_at = clock_timestamp()
    where id = v_session.id;
    return jsonb_build_object('ok', true, 'status', 'playing');
  end if;

  if p_action = 'advance' then
    if v_session.status <> 'playing' then
      raise exception 'La partie doit être en cours pour avancer.';
    end if;
    if v_session.question_open then
      update public.wedding_quiz_sessions
      set question_open = false, leaderboard_visible = true,
          question_ends_at = least(question_ends_at, clock_timestamp()),
          updated_at = clock_timestamp()
      where id = v_session.id;
      return jsonb_build_object('ok', true, 'revealed', true);
    end if;
    v_order_position := array_position(v_session.question_order, v_session.current_question);
    if v_order_position is null or v_order_position >= cardinality(v_session.question_order) then
      update public.wedding_quiz_sessions
      set status = 'finished', leaderboard_visible = true, updated_at = clock_timestamp()
      where id = v_session.id;
      return jsonb_build_object('ok', true, 'status', 'finished');
    end if;
    update public.wedding_quiz_sessions
    set current_question = v_session.question_order[v_order_position + 1],
        question_open = true, question_started_at = clock_timestamp(),
        question_ends_at = clock_timestamp() + interval '12 seconds',
        leaderboard_visible = false, updated_at = clock_timestamp()
    where id = v_session.id;
    return jsonb_build_object('ok', true, 'revealed', false);
  end if;

  if p_action = 'pause' then
    if v_session.status <> 'playing' then
      raise exception 'La partie ne peut être mise en pause dans cet état.';
    end if;
    update public.wedding_quiz_sessions
    set status = 'paused',
        remaining_ms = case when question_open then greatest(0,
          floor(extract(epoch from (question_ends_at - clock_timestamp())) * 1000)::integer)
          else 0 end,
        updated_at = clock_timestamp()
    where id = v_session.id;
    return jsonb_build_object('ok', true, 'status', 'paused');
  end if;

  if p_action = 'resume' then
    if v_session.status <> 'paused' then
      raise exception 'La partie n’est pas en pause.';
    end if;
    update public.wedding_quiz_sessions
    set status = 'playing',
        question_started_at = case when question_open then clock_timestamp() else question_started_at end,
        question_ends_at = case when question_open
          then clock_timestamp() + make_interval(secs => greatest(0, remaining_ms) / 1000.0)
          else question_ends_at end,
        remaining_ms = null,
        updated_at = clock_timestamp()
    where id = v_session.id;
    return jsonb_build_object('ok', true, 'status', 'playing');
  end if;

  if p_action = 'finish' then
    if v_session.status = 'finished' then
      raise exception 'La partie est déjà terminée.';
    end if;
    update public.wedding_quiz_sessions
    set status = 'finished', question_open = false,
        leaderboard_visible = true, updated_at = clock_timestamp()
    where id = v_session.id;
    return jsonb_build_object('ok', true, 'status', 'finished');
  end if;

  if p_action = 'reset' then
    loop
      v_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
      exit when not exists (
        select 1 from public.wedding_quiz_sessions
        where code = v_code and id <> v_session.id
      );
    end loop;
    delete from public.wedding_quiz_players where session_id = v_session.id;
    update public.wedding_quiz_sessions
    set code = v_code, status = 'waiting', current_question = -1,
        question_order = '{}', answer_orders = '{}'::jsonb,
        question_open = false, question_started_at = null, question_ends_at = null,
        remaining_ms = null, leaderboard_visible = false, updated_at = clock_timestamp()
    where id = v_session.id;
    return jsonb_build_object('ok', true, 'status', 'waiting', 'code', v_code);
  end if;

  if p_action = 'host_state' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', player.id, 'pseudo', player.pseudo, 'avatarIndex', player.avatar_index,
      'score', secret.score
    ) order by secret.score desc, player.joined_at), '[]'::jsonb)
    into v_players
    from public.wedding_quiz_players player
    join private.wedding_quiz_player_secrets secret on secret.player_id = player.id
    where player.session_id = v_session.id;
    v_reveal := not v_session.question_open
      or v_session.question_ends_at <= clock_timestamp();
    return jsonb_build_object(
      'sessionId', v_session.id, 'code', v_session.code, 'title', v_session.title,
      'description', v_session.description, 'status', v_session.status,
      'questionIndex', v_session.current_question,
      'questionNumber', coalesce(array_position(v_session.question_order, v_session.current_question), 0),
      'questionOpen', v_session.question_open,
      'questionStartedAt', v_session.question_started_at,
      'questionEndsAt', v_session.question_ends_at,
      'remainingMs', v_session.remaining_ms,
      'leaderboardVisible', v_session.leaderboard_visible,
      'question', private.wedding_quiz_question_payload(v_session.id, v_session.current_question, true),
      'players', v_players, 'playerCount', jsonb_array_length(v_players)
    );
  end if;

  if p_action = 'answer' then
    if v_session.status <> 'playing' or not v_session.question_open
      or v_session.question_ends_at <= clock_timestamp() then
      raise exception 'Le temps de réponse est écoulé.';
    end if;
    v_answer_id := p_payload ->> 'answer_id';
    select * into v_question
    from private.wedding_quiz_questions where position = v_session.current_question;
    if v_answer_id is null or not exists (
      select 1 from jsonb_array_elements(v_question.choices) as choice(value)
      where choice.value ->> 'id' = v_answer_id
    ) then
      raise exception 'Cette réponse ne fait pas partie des propositions.';
    end if;
    if exists (
      select 1 from private.wedding_quiz_answers
      where player_id = v_player.id and session_id = v_session.id
        and question_index = v_session.current_question
    ) then
      raise exception 'Une réponse a déjà été enregistrée pour cette question.';
    end if;
    v_correct := v_answer_id = v_question.correct_answer_id;
    v_ratio := greatest(0, least(1,
      extract(epoch from (v_session.question_ends_at - clock_timestamp()))
      / (v_question.duration * 1.0)
    ));
    v_points := case when v_correct
      then round(v_question.base_points * v_question.points_multiplier * (0.5 + 0.5 * v_ratio))::integer
      else 0 end;
    insert into private.wedding_quiz_answers
      (player_id, session_id, question_index, answer_id, is_correct, awarded_points)
    values (v_player.id, v_session.id, v_session.current_question, v_answer_id, v_correct, v_points);
    update private.wedding_quiz_player_secrets
    set score = score + v_points, streak = case when v_correct then streak + 1 else 0 end
    where player_id = v_player.id;
    return jsonb_build_object('accepted', true);
  end if;

  if p_action = 'player_state' then
    select score into v_points
    from private.wedding_quiz_player_secrets where player_id = v_player.id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'pseudo', player.pseudo, 'avatarIndex', player.avatar_index, 'score', secret.score
    ) order by secret.score desc, player.joined_at), '[]'::jsonb)
    into v_leaderboard
    from public.wedding_quiz_players player
    join private.wedding_quiz_player_secrets secret on secret.player_id = player.id
    where player.session_id = v_session.id;
    v_reveal := not v_session.question_open
      or v_session.question_ends_at <= clock_timestamp();
    return jsonb_build_object(
      'sessionId', v_session.id, 'code', v_session.code, 'title', v_session.title,
      'status', v_session.status, 'questionNumber',
      coalesce(array_position(v_session.question_order, v_session.current_question), 0),
      'questionCount', 15, 'questionOpen', v_session.question_open,
      'questionStartedAt', v_session.question_started_at,
      'questionEndsAt', v_session.question_ends_at, 'remainingMs', v_session.remaining_ms,
      'leaderboardVisible', v_session.leaderboard_visible or v_reveal,
      'question', private.wedding_quiz_question_payload(v_session.id, v_session.current_question, v_reveal),
      'answered', exists (
        select 1 from private.wedding_quiz_answers
        where player_id = v_player.id and session_id = v_session.id
          and question_index = v_session.current_question
      ),
      'score', case when v_reveal or v_session.status = 'finished' then v_points else null end,
      'leaderboard', case when v_session.leaderboard_visible or v_reveal
        then v_leaderboard else null end
    );
  end if;

  raise exception 'Action de partie inconnue.';
end;
$$;

revoke all on function public.wedding_quiz_action(text, jsonb) from public;
grant execute on function public.wedding_quiz_action(text, jsonb) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'wedding_quiz_sessions'
  ) then
    alter publication supabase_realtime add table public.wedding_quiz_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'wedding_quiz_players'
  ) then
    alter publication supabase_realtime add table public.wedding_quiz_players;
  end if;
end;
$$;

-- Après avoir créé le compte Supabase Auth du créateur, associer son UUID ici :
-- update private.wedding_quiz_owner
-- set owner_id = 'UUID-DU-COMPTE-AUTH'::uuid
-- where singleton = true;
