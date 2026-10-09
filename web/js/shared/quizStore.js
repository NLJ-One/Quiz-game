import { validateQuiz } from '../../shared/quiz-schema.js';

const STORAGE_KEY = 'weddingquiz.quizzes';

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `quiz-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readQuizzes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const stored = JSON.parse(raw);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
      throw new Error('format invalide');
    }
    const quizzes = Object.create(null);
    for (const [id, quiz] of Object.entries(stored)) quizzes[id] = quiz;
    return quizzes;
  } catch (error) {
    throw new Error('Les quiz enregistrés sont illisibles. Exporte tes données avant de les remplacer.', { cause: error });
  }
}

function writeQuizzes(quizzes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
  } catch (error) {
    if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      throw new Error('Stockage plein. Exporte tes quiz puis supprime les anciens.', { cause: error });
    }
    throw error;
  }
}

export function list() {
  return Object.values(readQuizzes());
}

export function get(id) {
  const quizzes = readQuizzes();
  return Object.hasOwn(quizzes, id) ? quizzes[id] : null;
}

export function save(quiz) {
  const result = validateQuiz(quiz);
  if (!result.valid) throw new Error(result.errors.join(' '));
  const quizzes = readQuizzes();
  const saved = { ...quiz, id: quiz.id || makeId() };
  quizzes[saved.id] = saved;
  writeQuizzes(quizzes);
  return saved;
}

export function remove(id) {
  const quizzes = readQuizzes();
  if (!Object.hasOwn(quizzes, id)) return false;
  delete quizzes[id];
  writeQuizzes(quizzes);
  return true;
}

export function duplicate(id) {
  const quiz = get(id);
  if (!quiz) throw new Error('Quiz introuvable.');
  return save({ ...quiz, id: makeId(), title: `${quiz.title} (copie)` });
}

export function exportToFile(id) {
  const quiz = get(id);
  if (!quiz) throw new Error('Quiz introuvable.');
  const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${quiz.title.replace(/[^a-z0-9-_]/gi, '-') || 'quiz'}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importFromFile(file) {
  if (!(file instanceof Blob)) throw new Error('Sélectionne un fichier JSON valide.');
  let quiz;
  try {
    quiz = JSON.parse(await file.text());
  } catch (error) {
    throw new Error('Le fichier sélectionné ne contient pas de JSON valide.', { cause: error });
  }

  const result = validateQuiz(quiz);
  if (!result.valid) throw new Error(result.errors.join(' '));

  const quizzes = readQuizzes();
  const imported = { ...quiz };
  if (quizzes[imported.id]) imported.id = makeId();
  quizzes[imported.id] = imported;
  writeQuizzes(quizzes);
  return imported;
}

export async function ensureDefaultQuiz() {
  if (list().length) return;
  const response = await fetch('/data/default-quiz.json');
  if (!response.ok) throw new Error(`Impossible de charger le quiz exemple (${response.status}).`);
  save(await response.json());
}
