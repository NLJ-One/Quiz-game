import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20261010000000_chloe_gilles_wedding_quiz.sql', import.meta.url),
  'utf8'
);
const editor = await readFile(
  new URL('../web/js/editor/main.js', import.meta.url),
  'utf8'
);

function seededQuestions() {
  const match = migration.match(/\$questions\$(\[[\s\S]*?\])\$questions\$::jsonb/);
  assert.ok(match, 'le jeu de questions JSON doit exister dans la migration');
  return JSON.parse(match[1]);
}

test('le quiz préenregistré contient les 15 questions et les réponses de la source', () => {
  const questions = seededQuestions();
  assert.equal(questions.length, 15);
  assert.deepEqual(
    questions.map(({ question, correct_answer_id }) => [question, correct_answer_id]),
    [
      ['La couleur préférée de Chloé ?', 'B'],
      ['Depuis combien de temps Gilles vit seul ?', 'C'],
      ['En quelle année Gilles et Chloé se sont vues pour la première fois ?', 'B'],
      ['Quel est le club de foot préféré de Gilles ?', 'C'],
      ['Quels est le 2ième métier que Chloé aurait aimé pratiquer ?', 'A'],
      ['Quel est le premier film que les mariés sont allés voir ensemble au cinéma ?', 'A'],
      ['Quel est le genre de musique préféré de Gilles ?', 'C'],
      ['Quel sport pratiquait Chloé durant son enfance ?', 'A'],
      ['Combien de temps Gilles a t-il pris pour déclarer sa flamme ?', 'B'],
      ['Quel est le deuxième prénom de Gilles ?', 'A'],
      ['Comment se nomme la chanteuse préférée de Chloé ?', 'C'],
      ['Quel point commun ont les mariés ?', 'B'],
      ['La première voiture que Gilles a acheté ?', 'A'],
      ['La première ville où Chloé a enseignée ?', 'C'],
      ['à partir de quelle mois Gilles et Chloé ont commencé à se fréquenter ?', 'B']
    ]
  );

  for (const question of questions) {
    assert.equal(question.choices.length, 4, question.question);
    assert.deepEqual(question.choices.map(({ id }) => id).sort(), ['A', 'B', 'C', 'D']);
    assert.ok(question.choices.some(({ id }) => id === question.correct_answer_id));
  }
  assert.equal(questions[12].choices[1].text, 'Ferrari ');
  assert.equal(questions[13].choices[1].text, 'Paris ');
  assert.equal(questions[13].choices[3].text, 'Sevra,');
});

test('la migration conserve les paramètres et le score du quiz existant', () => {
  assert.match(migration, /duration integer not null default 12 check \(duration = 12\)/);
  assert.match(migration, /base_points integer not null default 150 check \(base_points = 150\)/);
  assert.match(migration, /points_multiplier integer not null default 15 check \(points_multiplier = 15\)/);
  assert.match(migration, /"speedBonus":true/);
  assert.match(migration, /"shuffleQuestions":true/);
  assert.match(migration, /"shuffleAnswers":true/);
  assert.match(migration, /"hostControlled":true/);
  assert.match(migration, /"synchronous":true/);
  assert.match(migration, /"nicknameRequired":true/);
  assert.match(migration, /"leaderboard":true/);
  assert.match(migration, /round\(v_question\.base_points \* v_question\.points_multiplier \* \(0\.5 \+ 0\.5 \* v_ratio\)\)::integer\s*\+\s*least\(v_secret\.streak \* 100, 500\)/);
  assert.match(editor, /Connaissez vous vraiment Chloé et Gilles/);
  assert.match(editor, /questionCount: 15/);
  assert.match(editor, /duration: 12/);
});

test('les contrôles et transitions de partie sont protégés côté Supabase', () => {
  assert.match(migration, /alter table public\.wedding_quiz_sessions enable row level security;/);
  assert.match(migration, /alter table public\.wedding_quiz_players enable row level security;/);
  assert.match(migration, /revoke all on public\.wedding_quiz_sessions, public\.wedding_quiz_players\s+from public, anon, authenticated;/);
  assert.match(migration, /if p_action in \('host_state', 'start', 'advance', 'pause', 'resume', 'finish', 'reset', 'leaderboard'\) then\s+if auth\.uid\(\) is null then/);
  assert.match(migration, /for update;\s+if not found or v_session\.owner_id is distinct from auth\.uid\(\)\s+or v_owner_id is distinct from auth\.uid\(\) then/);
  assert.match(migration, /if p_action = 'start' then\s+if v_session\.status <> 'waiting' then/);
  assert.match(migration, /where owner_id = auth\.uid\(\) and status <> 'finished'/);
  assert.match(migration, /primary key \(player_id, session_id, question_index\)/);
  assert.match(migration, /if p_action = 'leaderboard' then\s+if v_session\.status in \('waiting', 'finished'\)\s+or \(v_session\.question_open and v_session\.question_ends_at > clock_timestamp\(\)\) then/);
  assert.match(migration, /v_reveal := not v_session\.question_open\s+or \(v_session\.status = 'playing' and v_session\.question_ends_at <= clock_timestamp\(\)\);/);
});
