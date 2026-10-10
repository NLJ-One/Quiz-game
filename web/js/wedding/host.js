import {
  getSupabase,
  notifyWeddingGame,
  subscribeToWeddingGame,
  weddingAction,
  weddingAnimationState
} from '/js/shared/supabase.js';
import { animateListPositions, animateNumber } from '/js/shared/game-animations.js';
import { createFinalPodium } from '/js/shared/final-podium.js';
import { ANIMAL_AVATARS, normalizeAvatarIndex } from '/shared/avatars.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  let sessionId = new URLSearchParams(location.search).get('session') || '';
  let currentState = null;
  let onlineIds = new Set();
  let refreshPending = false;
  let timerHandle;
  let previousRanks = new Map();
  let playerRows = new Map();
  let hostAnimationState = null;
  let podium;
  let fetchingFinalState = false;

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
    const previousPositions = new Map(
      [...playersList.children].map((item) => [item.dataset.playerId, item.getBoundingClientRect().top])
    );
    const sortedPlayers = currentState.players
      .map((player, index) => ({ player, index }))
      .sort((left, right) => Number(right.player.score) - Number(left.player.score) || left.index - right.index)
      .map(({ player }) => player);
    const nextRanks = new Map();
    for (const [index, player] of sortedPlayers.entries()) {
      let item = playerRows.get(player.id);
      if (!item) {
        item = document.createElement('li');
        item.className = 'player-list__row';
        item.dataset.playerId = player.id;
        const rank = document.createElement('span');
        rank.className = 'player-list__rank';
        const presence = document.createElement('span');
        presence.className = 'player-list__presence';
        presence.setAttribute('aria-hidden', 'true');
        const avatar = document.createElement('span');
        avatar.className = 'player-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.className = 'player-list__player';
        const score = document.createElement('span');
        score.className = 'player-list__score';
        const change = document.createElement('span');
        change.className = 'player-list__rank-change';
        item.append(rank, presence, avatar, name, score, change);
        playerRows.set(player.id, item);
      }
      const [rank, presence, avatar, name, score, change] = item.children;
      const currentRank = index + 1;
      const previousRank = previousRanks.get(player.id);
      rank.textContent = String(currentRank);
      rank.setAttribute('aria-label', `Rang ${currentRank}`);
      presence.textContent = onlineIds.has(player.id) ? '🟢' : '⚪';
      presence.setAttribute('aria-label', onlineIds.has(player.id) ? 'En ligne' : 'Hors ligne');
      avatar.textContent = ANIMAL_AVATARS[normalizeAvatarIndex(player.avatarIndex)];
      name.textContent = player.pseudo;
      const scoreValue = Number(player.score || 0);
      const oldScore = Number(score.dataset.score);
      if (score.dataset.score === undefined) {
        score.textContent = `${scoreValue.toLocaleString('fr-FR')} pts`;
      } else if (oldScore !== scoreValue) {
        animateNumber(score, oldScore, scoreValue, {
          duration: 750,
          format: (value) => `${Math.round(value).toLocaleString('fr-FR')} pts`
        });
      }
      score.dataset.score = String(scoreValue);
      if (previousRank !== undefined && previousRank !== currentRank) {
        const places = previousRank - currentRank;
        change.className = `player-list__rank-change player-list__rank-change--${places > 0 ? 'up' : 'down'}`;
        change.textContent = `${places > 0 ? '↑' : '↓'} ${places > 0 ? '+' : ''}${places} place${Math.abs(places) > 1 ? 's' : ''}`;
        change.setAttribute('aria-label', `${Math.abs(places)} place${Math.abs(places) > 1 ? 's' : ''} ${places > 0 ? 'gagnée' : 'perdue'}${Math.abs(places) > 1 ? 's' : ''}`);
      } else {
        change.className = 'player-list__rank-change player-list__rank-change--steady';
        change.textContent = previousRank === undefined ? '' : '— Stable';
        change.removeAttribute('aria-label');
      }
      nextRanks.set(player.id, currentRank);
      playersList.append(item);
    }
    const activePlayerIds = new Set(sortedPlayers.map((player) => player.id));
    for (const [id, item] of playerRows) {
      if (!activePlayerIds.has(id)) {
        item.remove();
        playerRows.delete(id);
      }
    }
    animateListPositions(playersList, previousPositions);
    previousRanks = nextRanks;
    playersEmpty.hidden = currentState.players.length > 0;

    const start = document.querySelector('#seeded-host-start');
    const next = document.querySelector('#seeded-host-next');
    const pause = document.querySelector('#seeded-host-pause');
    const finish = document.querySelector('#seeded-host-finish');
    const showBoard = document.querySelector('#seeded-host-show-board');
    start.disabled = currentState.status !== 'waiting';
    const questionStillOpen = currentState.status === 'playing'
      && currentState.questionOpen
      && Date.parse(currentState.questionEndsAt) > Date.now();
    next.disabled = currentState.status !== 'playing' || questionStillOpen;
    next.textContent = currentState.questionOpen
      ? 'Révéler la réponse'
      : currentState.questionNumber >= 15 ? 'Terminer le quiz' : 'Question suivante';
    pause.disabled = currentState.status !== 'playing' && currentState.status !== 'paused';
    pause.textContent = currentState.status === 'paused' ? 'Reprendre' : 'Mettre en pause';
    finish.disabled = currentState.status === 'finished';
    const questionHasEnded = !currentState.questionOpen
      || (currentState.status === 'playing'
        && Date.parse(currentState.questionEndsAt) <= Date.now());
    showBoard.disabled = currentState.status === 'waiting'
      || currentState.status === 'finished'
      || !questionHasEnded;
    showBoard.textContent = currentState.leaderboardVisible ? 'Masquer le classement' : 'Afficher le classement';
    document.querySelector('#seeded-host-reset').disabled = false;

    question.replaceChildren();
    if (currentState.question) {
      const heading = document.createElement('h2');
      heading.textContent = `Question ${currentState.questionNumber} / 15`;
      const prompt = document.createElement('p');
      prompt.textContent = currentState.question.text;
      const options = document.createElement('ul');
      for (const choice of currentState.question.choices) {
        const option = document.createElement('li');
        const label = `${choice.id}. ${choice.text}`;
        option.textContent = choice.id === currentState.question.correctAnswerId
          ? `✓ ${label}` : label;
        options.append(option);
      }
      question.append(heading, prompt, options);
      if (currentState.question.correctAnswerId) {
        const answer = document.createElement('p');
        answer.className = 'status-message';
        const correct = currentState.question.choices.find(
          (choice) => choice.id === currentState.question.correctAnswerId
        );
        answer.textContent = `Bonne réponse : ${correct?.text || currentState.question.correctAnswerId}`;
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

    if (podium && currentState.status !== 'finished') {
      podium.destroy();
      podium = null;
    }
    leaderboard.replaceChildren();
    leaderboard.hidden = !currentState.leaderboardVisible && currentState.status !== 'finished';
    if (currentState.leaderboardVisible || currentState.status === 'finished') {
      const heading = document.createElement('h2');
      heading.textContent = 'Classement';
      const list = document.createElement('ol');
      list.className = 'wedding-leaderboard__list';
      for (const [index, player] of sortedPlayers.entries()) {
        const item = document.createElement('li');
        item.className = 'wedding-leaderboard__row';
        item.dataset.playerId = player.id;
        const entry = document.createElement('span');
        entry.className = 'wedding-leaderboard__entry';
        const name = document.createElement('span');
        name.textContent = `${index + 1}. ${player.pseudo}`;
        const score = document.createElement('span');
        score.className = 'wedding-leaderboard__score';
        score.textContent = `${Number(player.score || 0).toLocaleString('fr-FR')} pts`;
        entry.append(name, score);
        item.append(entry);
        list.append(item);
      }
      const board = document.createElement('div');
      board.className = 'wedding-leaderboard';
      board.append(heading, list);
      leaderboard.append(board);
      if (currentState.status === 'finished' && hostAnimationState) {
        if (!podium) podium = createFinalPodium(leaderboard);
        podium.mount(leaderboard);
        podium.update(
          hostAnimationState.leaderboard || sortedPlayers,
          hostAnimationState.finishedAt,
          hostAnimationState.elapsedMs
        );
      }
    } else if (podium) {
      podium.destroy();
      podium = null;
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
    const remaining = currentState.status === 'paused'
      ? Math.max(0, Math.ceil((currentState.remainingMs || 0) / 1000))
      : Math.max(0, Math.ceil((Date.parse(currentState.questionEndsAt) - Date.now()) / 1000));
    timer.textContent = `Temps restant : ${remaining} s`;
    const next = document.querySelector('#seeded-host-next');
    if (currentState.status === 'playing' && currentState.questionOpen) {
      next.disabled = remaining > 0;
      next.textContent = remaining > 0 ? 'Question en cours…' : 'Révéler la réponse';
    }
    if (remaining > 0 && currentState.status !== 'paused') {
      timerHandle = window.setTimeout(updateTimer, 250);
    }
  }

  async function refresh() {
    if (refreshPending || !sessionId) return;
    refreshPending = true;
    try {
      currentState = await weddingAction('host_state', { session_id: sessionId });
      if (currentState.status === 'finished' && !hostAnimationState && !fetchingFinalState) {
        fetchingFinalState = true;
        try {
          hostAnimationState = await weddingAnimationState({ session_id: sessionId });
        } finally {
          fetchingFinalState = false;
        }
      } else if (currentState.status !== 'finished') {
        hostAnimationState = null;
      }
      controls.hidden = false;
      authPanel.hidden = true;
      setStatus('');
      render();
    } catch (error) {
      setStatus(error.message, true);
      if (error.message.includes('propriétaire authentifié') || error.message.includes('Authentification organisateur')) {
        controls.hidden = true;
        authPanel.hidden = false;
      }
    } finally {
      refreshPending = false;
    }
  }

  async function runAction(action) {
    controls.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    try {
      const result = await weddingAction(action, { session_id: sessionId });
      if (action === 'reset' && result.code) {
        document.querySelector('#host-code').textContent = result.code;
      }
      await refresh();
      void notifyWeddingGame(sessionId).catch((error) => {
        console.warn('La notification Realtime a échoué; actualisation automatique active.', error);
        setStatus('La commande est enregistrée, mais la notification instantanée a échoué. Actualisation automatique active.', true);
      });
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
  document.querySelector('#seeded-host-reset').addEventListener('click', () => {
    if (window.confirm('Réinitialiser cette session, supprimer les joueurs et créer un nouveau code ?')) {
      runAction('reset');
    }
  });

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
    await channelHolder.channel?.unsubscribe();
    channelHolder.channel = null;
  });

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!sessionId && new URLSearchParams(location.search).get('seed') === 'chloe-gilles') {
    if (session) {
      const catalog = await weddingAction('catalog');
      sessionId = catalog.sessionId;
    }
  }
  if (!UUID_PATTERN.test(sessionId)) {
    setStatus('Aucune session préparée pour ce quiz.', true);
    authPanel.hidden = true;
    location.replace('/editor.html');
    return;
  }

  if (session) await refresh();
  else {
    authPanel.hidden = false;
    setStatus('Connecte-toi avec le compte organisateur autorisé.');
  }

  const subscription = subscribeToWeddingGame(sessionId, () => {
    refresh().catch((error) => setStatus(error.message, true));
  }, updatePresence);
  channelHolder.channel = subscription.channel;
  subscription.ready.then(() => {
    return subscription.channel.track({ role: 'host', userId: session?.user?.id });
  }).catch((error) => {
    console.warn('Synchronisation temps réel indisponible; actualisation automatique active.', error);
    setStatus('Connexion Realtime indisponible. La salle reste actualisée automatiquement.', true);
  });
  window.setInterval(() => {
    if (currentState) refresh();
  }, 2500);
}
