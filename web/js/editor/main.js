import { apiFetch } from '/js/config.js';
import { TEXTS } from '/shared/texts.fr.js';
import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { newQuestion } from '/shared/quiz-schema.js';
import { renderHeader } from '/js/shared/header.js';
import { applyTheme } from '/js/shared/theme.js';
import { isLoggedIn, login, logout } from '/js/shared/auth.js';
import { ensureDefaultQuiz, list, save } from '/js/shared/quizStore.js';
import { getSupabase, isSupabaseConfigured, weddingAction } from '/js/shared/supabase.js';
import { getSupabase, isSupabaseConfigured, weddingAction } from '/js/shared/supabase.js';

const WEDDING_SESSION_ID = 'chloe-gilles-wedding';
const quizList = document.querySelector('#quiz-list');
const status = document.querySelector('#editor-status');
const loginPanel = document.querySelector('#host-login');
const loginForm = document.querySelector('#host-login-form');
const seededLoginPanel = document.querySelector('#seeded-host-auth');
const seededLoginForm = document.querySelector('#seeded-host-login-form');
const seededLoginStatus = document.querySelector('#seeded-host-auth-status');
let pendingQuizId = null;
const presetStatus = document.querySelector('#preset-status');
const presetLoginForm = document.querySelector('#preset-login-form');
const presetPrepare = document.querySelector('#preset-prepare');
const presetLogout = document.querySelector('#preset-logout');
let presetOwnerSession = null;
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
  seededLaunch.textContent = 'Lancer la partie';
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
        seededCatalog = await weddingAction('catalog', { session_id: WEDDING_SESSION_ID });
      } catch (error) {
        setStatus(`Quiz préenregistré indisponible : ${error.message}`, true);
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
    const { data: { session } } = await getSupabase().auth.getSession();
    if (!session) {
      seededLoginPanel.hidden = false;
      document.querySelector('#seeded-host-email').focus();
      return;
    }
    await weddingAction('host_state', { session_id: WEDDING_SESSION_ID });
    location.assign('/host.html?seed=chloe-gilles');
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

async function loadPresetQuiz() {
  presetPrepare.hidden = true;
  presetLogout.hidden = true;
  presetLoginForm.hidden = true;
  if (!isSupabaseConfigured()) {
    presetStatus.textContent = 'Configure Supabase dans /js/supabase.config.js puis applique la migration SQL avant de te connecter.';
    presetStatus.classList.add('error-message');
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) {
      presetLoginForm.hidden = false;
      presetStatus.textContent = 'Connecte-toi avec le compte Supabase Auth désigné comme propriétaire du quiz.';
      presetStatus.classList.remove('error-message');
      return;
    }

    presetLogout.hidden = false;
    presetOwnerSession = await weddingAction('catalog');
    const currentSession = presetOwnerSession.sessionId
      ? `Salle ${presetOwnerSession.code} · ${presetOwnerSession.status === 'waiting' ? 'en attente' : presetOwnerSession.status === 'playing' ? 'en cours' : presetOwnerSession.status === 'paused' ? 'en pause' : 'terminée'}.`
      : 'Aucune session n’a encore été préparée.';
    presetStatus.textContent = `${currentSession} Le quiz et ses 15 questions sont enregistrés dans Supabase.`;
    presetStatus.classList.remove('error-message');
    presetPrepare.textContent = presetOwnerSession.status === 'finished' || !presetOwnerSession.sessionId
      ? 'Préparer la partie'
      : presetOwnerSession.status === 'waiting' ? 'Ouvrir la salle d’attente' : 'Reprendre le contrôle';
    presetPrepare.hidden = false;
  } catch (error) {
    presetStatus.textContent = error.message || 'Impossible de charger le quiz préenregistré.';
    presetStatus.classList.add('error-message');
  }
}

document.querySelector('#preset-prepare').addEventListener('click', async () => {
  presetPrepare.disabled = true;
  presetStatus.textContent = 'Préparation de la salle…';
  try {
    const session = await weddingAction('prepare');
    if (!session?.sessionId || !/^\d{6}$/.test(session.code)) {
      throw new Error('Supabase a renvoyé une salle invalide.');
    }
    location.assign(`/host.html?session=${encodeURIComponent(session.sessionId)}`);
  } catch (error) {
    presetStatus.textContent = error.message || 'Impossible de préparer la partie.';
    presetStatus.classList.add('error-message');
    presetPrepare.disabled = false;
  }
});

document.querySelector('#preset-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const email = new FormData(form).get('email');
  const password = new FormData(form).get('password');
  submit.disabled = true;
  presetStatus.textContent = 'Connexion…';
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    form.reset();
    await loadPresetQuiz();
  } catch (error) {
    presetStatus.textContent = error.message || 'La connexion a échoué.';
    presetStatus.classList.add('error-message');
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#preset-logout').addEventListener('click', async () => {
  try {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
    await loadPresetQuiz();
  } catch (error) {
    presetStatus.textContent = error.message || 'La déconnexion a échoué.';
    presetStatus.classList.add('error-message');
  }
});

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
    await weddingAction('host_state', { session_id: WEDDING_SESSION_ID });
    location.assign('/host.html?seed=chloe-gilles');
  } catch (error) {
    seededLoginStatus.textContent = error.message;
    seededLoginStatus.classList.add('error-message');
  } finally {
    submit.disabled = false;
  }
});

loadQuizzes();
loadPresetQuiz();
