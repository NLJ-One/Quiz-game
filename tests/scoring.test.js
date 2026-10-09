import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, normalizeText } from '../web/shared/scoring.js';

test('normalizeText enlève les accents et la ponctuation', () => {
  assert.equal(normalizeText('Café, très bien !'), 'cafe tres bien');
});

test('single score donne le maximum si réponse correcte et délai long', () => {
  const q = { type: 'single', points: 'standard', correctAnswer: 'Bleu' };
  const score = computeScore(q, 'Bleu', 1, { pointsBase: 1000, speedBonus: true }, 2);
  assert.ok(score > 0);
  assert.equal(score, 1200);
});

test('multiple score applique une pénalité aux mauvais choix', () => {
  const q = { type: 'multiple', points: 'standard', correctAnswers: ['A', 'B'] };
  const score = computeScore(q, ['A', 'C'], 1, { pointsBase: 1000, speedBonus: true }, 0);
  assert.ok(score >= 0);
  assert.ok(score < 1000);
});

test('slider score diminue avec l\'écart', () => {
  const q = { type: 'slider', correctValue: 50, tolerance: 5, min: 0, max: 100 };
  const good = computeScore(q, 50, 1, { pointsBase: 1000, speedBonus: true }, 0);
  const bad = computeScore(q, 80, 1, { pointsBase: 1000, speedBonus: true }, 0);
  assert.ok(good > bad);
});

test('text score compare les réponses normalisées', () => {
  const q = { type: 'text', acceptedAnswers: ['Bonjour les amis'] };
  const score = computeScore(q, 'bonjour, les amis!', 1, { pointsBase: 1000, speedBonus: true }, 0);
  assert.equal(score, 1000);
});

test('poll retourne 0 point', () => {
  const q = { type: 'poll', choices: ['A', 'B'] };
  assert.equal(computeScore(q, 'A', 1, { pointsBase: 1000 }, 0), 0);
});
