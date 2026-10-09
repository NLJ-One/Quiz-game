import { getSupabase, subscribeToWeddingGame, weddingAction } from '/js/shared/supabase.js';

const SESSION_ID = 'chloe-gilles-wedding';

export async function mountWeddingHost() {
  const supabase = getSupabase();
  const authPanel = document.querySelector('#seeded-host-auth');
  const form = document.querySelector('#seeded-host-login-form');
  const controls = document.querySelector('#seeded-host-controls');
  const status = document.querySelector('#host-status');
  const statusBadge = document.querySelector('#seeded-host-state');
  const playersList = document.querySelector('#player-list');
  const playersEmpty = document.querySelector('#player-empty');
  const playerCount = document.querySelector('#player-count');
  const question = document.querySelector('#seeded-host-question');
  const leaderboard = document.querySelector('#seeded-host-leaderboard');
  const channelHolder = { channel: null };
  let currentState = null;
  let onlineIds = new Set();
  let refreshPending = false;
  let timerHandle;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error-message', isError);
  }

  function render() {
    if (!currentState) return;
    window.clearTimeout(timerHandle);
    const labels = {
      waiting: 'En attente',
      playing: 'En cours',
      paused: 'En pause',
      finished: 'Terminée'
    };
    statusBadge.textContent = labels[currentState.status] || currentState.status;
    document.querySelector('#host-code').textContent = currentState.code;
    document.querySelector('#seeded-host-title').textContent = `Quiz : ${currentState.title}`;
    playerCount.textContent = `Participants : ${onlineIds.size} connecté${onlineIds.size > 1 ? 's' : ''} / ${currentState.players.length} inscrit${currentState.players.length > 1 ? 's' : ''}`;
    playersList.replaceChildren();
    for (const player of currentState.players) {
      const item = document.createElement('li');
      item.textContent = `${onlineIds.has(player.id) ? '🟢' : '⚪'} ${player.pseudo} — ${player.score} pts`;
      playersList.append(item);
    }
    playersEmpty.hidden = currentState.players.length > 0;

    const start = document.querySelector('#seeded-host-start');
    const next = document.querySelector('#seeded-host-next');
    const pause = document.querySelector('#seeded-host-pause');
    const finish = document.querySelector('#seeded-host-finish');
    const showBoard = document.querySelector('#seeded-host-show-board');
    start.disabled = currentState.status !== 'waiting';
    next.disabled = currentState.status !== 'playing';
    next.textContent = currentState.questionOpen ? 'Question suivante' : 'Question suivante';
    pause.disabled = !(
      currentState.status === 'paused'
      || (currentState.status === 'playing' && currentState.questionOpen)
    );
    pause.textContent = currentState.status === 'paused' ? 'Reprendre' : 'Mettre en pause';
    finish.disabled = currentState.status === 'finished';
    showBoard.disabled = currentState.status === 'waiting' || currentState.status === 'finished';
    showBoard.textContent = currentState.leaderboardVisible ? 'Masquer le classement' : 'Afficher le classement';

    question.replaceChildren();
    if (currentState.question) {
      const heading = document.createElement('h2');
      heading.textContent = `Question ${currentState.questionIndex + 1} / 15`;
      const prompt = document.createElement('p');
      prompt.textContent = currentState.question.text;
      const options = document.createElement('ul');
      for (const choice of currentState.question.choices) {
        const option = document.createElement('li');
        option.textContent = choice === currentState.question.correctAnswer ? `✓ ${choice}` : choice;
        options.append(option);
      }
      question.append(heading, prompt, options);
      if (currentState.question.correctAnswer) {
        const answer = document.createElement('p');
        answer.className = 'status-message';
        answer.textContent = `Bonne réponse : ${currentState.question.correctAnswer}`;
        question.append(answer);
      }
      if (currentState.questionOpen && currentState.questionEndsAt) {
        const timer = document.createElement('p');
        timer.id = 'seeded-host-timer';
        question.append(timer);
      }
    } else {
      question.textContent = currentState.status === 'waiting'
        ? 'Les invités peuvent rejoindre la salle avec le code ci-dessus.'
        : 'Aucune question à afficher.';
    }

    leaderboard.replaceChildren();
    leaderboard.hidden = !currentState.leaderboardVisible;
    if (currentState.leaderboardVisible) {
      const heading = document.createElement('h2');
      heading.textContent = 'Classement';
      const list = document.createElement('ol');
      for (const player of currentState.players) {
        const item = document.createElement('li');
        item.textContent = `${player.pseudo} — ${player.score} pts`;
        list.append(item);
      }
      leaderboard.append(heading, list);
    }
    updateTimer();
  }

  function updatePresence(presence) {
    onlineIds = new Set(
      Object.values(presence).flat().map((entry) => entry.playerId).filter(Boolean)
    );
    render();
  }

  function updateTimer() {
    const timer = document.querySelector('#seeded-host-timer');
    if (!timer || !currentState?.questionEndsAt) return;
    const remaining = Math.max(0, Math.ceil((Date.parse(currentState.questionEndsAt) - Date.now()) / 1000));
    timer.textContent = `Temps restant : ${remaining} s`;
    if (remaining > 0) timerHandle = window.setTimeout(updateTimer, 250);
  }

  async function refresh() {
    if (refreshPending) return;
    refreshPending = true;
    try {
      currentState = await weddingAction('host_state', { session_id: SESSION_ID });
      controls.hidden = false;
      authPanel.hidden = true;
      setStatus('');
      render();
    } catch (error) {
      setStatus(error.message, true);
      if (error.message.includes('propriétaire authentifié')) {
        controls.hidden = true;
        authPanel.hidden = false;
      }
    } finally {
      refreshPending = false;
    }
  }

  async function runAction(action) {
    const buttons = controls.querySelectorAll('button');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await weddingAction(action, { session_id: SESSION_ID });
      await refresh();
    } catch (error) {
      setStatus(error.message, true);
      render();
    }
  }

  document.querySelector('#seeded-host-start').addEventListener('click', () => runAction('start'));
  document.querySelector('#seeded-host-next').addEventListener('click', () => runAction('advance'));
  document.querySelector('#seeded-host-pause').addEventListener('click', () => (
    runAction(currentState?.status === 'paused' ? 'resume' : 'pause')
  ));
  document.querySelector('#seeded-host-finish').addEventListener('click', () => runAction('finish'));
  document.querySelector('#seeded-host-show-board').addEventListener('click', () => runAction('leaderboard'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    const values = new FormData(form);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.get('email'),
        password: values.get('password')
      });
      if (error) throw error;
      await refresh();
    } catch (error) {
      setStatus(error.message || 'Connexion impossible.', true);
    } finally {
      submit.disabled = false;
    }
  });

  document.querySelector('#seeded-host-logout').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus(error.message, true);
      return;
    }
    currentState = null;
    controls.hidden = true;
    authPanel.hidden = false;
    channelHolder.channel?.unsubscribe();
    channelHolder.channel = null;
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await refresh();
  } else {
    authPanel.hidden = false;
    setStatus('Connecte-toi avec le compte organisateur autorisé.');
  }

  const subscription = subscribeToWeddingGame(
    SESSION_ID,
    () => refresh(),
    updatePresence
  );
  channelHolder.channel = subscription;
  subscription.subscribe((channelStatus) => {
    if (channelStatus === 'SUBSCRIBED') {
      const userId = supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user?.id) subscription.track({ role: 'host', userId: data.session.user.id });
      });
      userId.catch((error) => setStatus(error.message, true));
    }
  });
  window.setInterval(() => {
    if (currentState) refresh();
  }, 10000);
}
