import { API_URL, apiFetch } from '/js/config.js';
import { TEXTS } from '/shared/texts.fr.js';
import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { newQuestion } from '/shared/quiz-schema.js';
import { renderHeader } from '/js/shared/header.js';
import { applyTheme } from '/js/shared/theme.js';
import { isLoggedIn, login, logout } from '/js/shared/auth.js';
import { ensureDefaultQuiz, list, save } from '/js/shared/quizStore.js';

const quizList = document.querySelector('#quiz-list');
const status = document.querySelector('#editor-status');
const loginPanel = document.querySelector('#host-login');
const loginForm = document.querySelector('#host-login-form');
let pendingQuizId = null;

applyTheme(WEDDING_CONFIG);
renderHeader();

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error-message', isError);
}

function renderQuizzes(quizzes) {
  quizList.replaceChildren();
  for (const quiz of quizzes) {
    const card = document.createElement('article');
    card.className = 'card quiz-item';

    const details = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = quiz.title;
    const summary = document.createElement('p');
    summary.className = 'muted';
    summary.textContent = `${quiz.questions.length} question${quiz.questions.length > 1 ? 's' : ''}`;
    details.append(heading, summary);

    const launch = document.createElement('button');
    launch.className = 'btn btn--primary';
    launch.type = 'button';
    launch.textContent = 'Lancer';
    launch.addEventListener('click', () => startQuiz(quiz.id));
    card.append(details, launch);
    quizList.append(card);
  }
}

async function loadQuizzes() {
  setStatus(TEXTS.loading);
  try {
    await ensureDefaultQuiz();
    const quizzes = list();
    renderQuizzes(quizzes);
    setStatus(`${quizzes.length} quiz prêt${quizzes.length > 1 ? 's' : ''}.`);
  } catch (error) {
    setStatus(error.message || TEXTS.quizLoadingError, true);
  }
}

async function startQuiz(quizId) {
  pendingQuizId = quizId;
  if (!isLoggedIn()) {
    loginPanel.hidden = false;
    document.querySelector('#host-password').focus();
    return;
  }
  await createRoom(quizId);
}

async function createRoom(quizId) {
  const quiz = list().find((item) => item.id === quizId);
  if (!quiz) {
    setStatus('Ce quiz est introuvable dans le navigateur.', true);
    return;
  }

  setStatus(TEXTS.loading);
  try {
    const response = await apiFetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz })
    });
    const result = await response.json();
    if (typeof result.code !== 'string' || !/^\d{6}$/.test(result.code)) {
      throw new Error('Le serveur a renvoyé un code de salle invalide.');
    }
    location.assign(`/host.html?code=${encodeURIComponent(result.code)}`);
  } catch (error) {
    if (error.status === 401) {
      logout();
      loginPanel.hidden = false;
      setStatus('Reconnectez-vous pour créer une salle.', true);
      document.querySelector('#host-password').focus();
      return;
    }
    setStatus(error.message, true);
  }
}

document.querySelector('#new-quiz').addEventListener('click', () => {
  try {
    const quiz = save({
      id: `quiz-${Date.now().toString(36)}`,
      title: 'Nouveau quiz',
      description: '',
      settings: {},
      questions: [newQuestion('single')]
    });
    renderQuizzes(list());
    setStatus(`« ${quiz.title} » a été créé. Vous pourrez le personnaliser dans l’éditeur complet.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = new FormData(loginForm).get('password');
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus(TEXTS.loading);
  try {
    await login(password);
    loginPanel.hidden = true;
    loginForm.reset();
    if (pendingQuizId) await createRoom(pendingQuizId);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submit.disabled = false;
  }
});

void API_URL;
loadQuizzes();
