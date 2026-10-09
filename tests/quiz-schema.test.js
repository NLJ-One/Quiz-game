import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateQuiz, newQuestion, defaultSettings } from '../web/shared/quiz-schema.js';

const validQuiz = {
  id: 'quiz-1',
  title: 'Quiz test',
  description: 'Description',
  settings: { ...defaultSettings },
  questions: [
    {
      id: 'q1',
      type: 'single',
      text: 'Quelle couleur est le ciel ?',
      duration: 30,
      points: 'standard',
      choices: ['Bleu', 'Rouge', 'Vert'],
      correctAnswer: 'Bleu'
    },
    {
      id: 'q2',
      type: 'multiple',
      text: 'Quels sont des fruits ?',
      duration: 20,
      points: 'double',
      choices: ['Pomme', 'Chaise', 'Orange'],
      correctAnswers: ['Pomme', 'Orange']
    }
  ]
};

test('validateQuiz accepte un quiz valide', () => {
  const result = validateQuiz(validQuiz);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateQuiz détecte un quiz invalide', () => {
  const result = validateQuiz({
    id: 'quiz-2',
    title: '',
    questions: [{ id: 'q', type: 'bad', text: 'X', duration: 2 }]
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('newQuestion génère un objet valide pour le type single', () => {
  const q = newQuestion('single');
  assert.equal(q.type, 'single');
  assert.ok(Array.isArray(q.choices));
  assert.ok(q.correctAnswer !== undefined);
});

test('defaultSettings contient les paramètres attendus', () => {
  assert.equal(defaultSettings.pointsBase, 1000);
  assert.equal(defaultSettings.leaderboardSize, 5);
});

test('le quiz exemple est valide', () => {
  const quiz = JSON.parse(fs.readFileSync(new URL('../web/data/default-quiz.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateQuiz(quiz), { valid: true, errors: [] });
});
