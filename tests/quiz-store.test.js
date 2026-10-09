import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { list, get, save, remove, duplicate, importFromFile } from '../web/js/shared/quizStore.js';

const defaultQuiz = JSON.parse(fs.readFileSync(new URL('../web/data/default-quiz.json', import.meta.url), 'utf8'));

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    if (this.full) throw new DOMException('quota exceeded', 'QuotaExceededError');
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

afterEach(() => {
  delete globalThis.localStorage;
});

test('enregistre, duplique et supprime un quiz localement', () => {
  const saved = save(structuredClone(defaultQuiz));
  assert.equal(get(saved.id).title, defaultQuiz.title);

  const copy = duplicate(saved.id);
  assert.notEqual(copy.id, saved.id);
  assert.equal(list().length, 2);
  assert.equal(remove(saved.id), true);
  assert.equal(get(saved.id), null);
});

test('refuse un quiz invalide et signale le stockage local plein', () => {
  assert.throws(() => save({ id: 'broken', title: 'Vide', questions: [] }), /au moins une question/);
  globalThis.localStorage.full = true;
  assert.throws(() => save(structuredClone(defaultQuiz)), /Exporte tes quiz puis supprime les anciens/);
});

test('importe un quiz validé avec un nouvel identifiant en cas de conflit', async () => {
  save(structuredClone(defaultQuiz));
  const imported = await importFromFile(new Blob([JSON.stringify(defaultQuiz)], { type: 'application/json' }));
  assert.notEqual(imported.id, defaultQuiz.id);
  assert.equal(list().length, 2);
});
