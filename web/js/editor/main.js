import { apiFetch } from '/js/config.js';
import { TEXTS } from '/shared/texts.fr.js';
import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { newQuestion } from '/shared/quiz-schema.js';
import { renderHeader } from '/js/shared/header.js';
import { applyTheme } from '/js/shared/theme.js';
import { isLoggedIn, login, logout } from '/js/shared/auth.js';
import { ensureDefaultQuiz, list, save } from '/js/shared/quizStore.js';
import { getSupabase, isSupabaseConfigured, weddingAction } from '/js/shared/supabase.js';

const quizList = document.querySelector('#quiz-list');
const status = document.querySelector('#editor-status');
const loginPanel = document.querySelector('#host-login');
const loginForm = document.querySelector('#host-login-form');
const seededLoginPanel = document.querySelector('#seeded-host-auth');
const seededLoginForm = document.querySelector('#seeded-host-login-form');
const seededLoginStatus = document.querySelector('#seeded-host-auth-status');
let pendingQuizId = null;
let seededCatalog = {
  title: 'Connaissez vous vraiment Chloé et Gilles',
  description: 'On va voir si vos connaissez Gilles et Chloé.',
  status: 'waiting',
  questionCount: 15,
  duration: 12
};

applyTheme(WEDDING_CONFIG);
renderHeader();

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error-message', isError);
}

function renderQuizzes(quizzes) {
  quizList.replaceChildren();
  const seededCard = document.createElement('article');
  seededCard.className = 'card quiz-item';
  const seededDetails = document.createElement('div');
  const seededHeading = document.createElement('h2');
  seededHeading.textContent = seededCatalog.title;
  const seededDescription = document.createElement('p');
  seededDescription.className = 'muted';
  seededDescription.textContent = seededCatalog.description;
  const seededSummary = document.createElement('p');
  seededSummary.className = 'muted';
  const seededStatus = {
    waiting: 'En attente',
    playing: 'En cours',
    paused: 'En pause',
    finished: 'Terminée'
  }[seededCatalog.status] || seededCatalog.status;
  seededSummary.textContent = `${seededCatalog.questionCount} questions · ${seededCatalog.duration} secondes par question · ${seededStatus}`;
  seededDetails.append(seededHeading, seededDescription, seededSummary);
  const seededLaunch = document.createElement('button');
  seededLaunch.className = 'btn btn--primary';
  seededLaunch.type = 'button';
  seededLaunch.textContent = seededCatalog.status === 'finished'
    ? 'Préparer une nouvelle partie'
    : seededCatalog.sessionId ? 'Ouvrir la salle d’attente' : 'Préparer la partie';
  seededLaunch.addEventListener('click', openSeededGame);
  seededCard.append(seededDetails, seededLaunch);
  quizList.append(seededCard);

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
    if (isSupabaseConfigured()) {
      try {
        const { data: { session }, error } = await getSupabase().auth.getSession();
        if (error) throw error;
        if (session) {
          const catalog = await weddingAction('catalog');
          if (catalog.sessionId) seededCatalog = { duration: 12, ...catalog };
        }
      } catch (error) {
        console.warn('Le statut du quiz préenregistré n’a pas pu être chargé.', error);
      }
    }
    await ensureDefaultQuiz();
    const quizzes = list();
    renderQuizzes(quizzes);
    if (!status.classList.contains('error-message')) {
      setStatus(`${quizzes.length + 1} quiz prêt${quizzes.length + 1 > 1 ? 's' : ''}.`);
    }
  } catch (error) {
    setStatus(error.message || TEXTS.quizLoadingError, true);
  }
}

async function openSeededGame() {
  seededLoginStatus.textContent = '';
  if (!isSupabaseConfigured()) {
    seededLoginPanel.hidden = false;
    seededLoginStatus.textContent = 'Configure Supabase dans /js/supabase.config.js puis applique la migration SQL.';
    return;
  }
  try {
    const { data: { session }, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    if (!session) {
      seededLoginPanel.hidden = false;
      document.querySelector('#seeded-host-email').focus();
      return;
    }
    const game = await weddingAction('prepare');
    if (!game?.sessionId) throw new Error('Supabase n’a pas retourné d’identifiant de salle.');
    location.assign(`/host.html?session=${encodeURIComponent(game.sessionId)}`);
  } catch (error) {
    seededLoginPanel.hidden = false;
    seededLoginStatus.textContent = error.message;
    seededLoginStatus.classList.add('error-message');
    document.querySelector('#seeded-host-email').focus();
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

seededLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = seededLoginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  seededLoginStatus.textContent = TEXTS.loading;
  seededLoginStatus.classList.remove('error-message');
  const values = new FormData(seededLoginForm);
  try {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: values.get('email'),
      password: values.get('password')
    });
    if (error) throw error;
    const game = await weddingAction('prepare');
    if (!game?.sessionId) throw new Error('Supabase n’a pas retourné d’identifiant de salle.');
    location.assign(`/host.html?session=${encodeURIComponent(game.sessionId)}`);
  } catch (error) {
    seededLoginStatus.textContent = error.message;
    seededLoginStatus.classList.add('error-message');
  } finally {
    submit.disabled = false;
  }
});

loadQuizzes();
