import {
  getSupabase,
  notifyWeddingGame,
  subscribeToWeddingGame,
  weddingAction,
  weddingAnimationState
} from '/js/shared/supabase.js';
import { animateListPositions, animateNumber, prefersReducedMotion } from '/js/shared/game-animations.js';
import { createFinalPodium } from '/js/shared/final-podium.js';

export async function mountWeddingPlayer(session, code) {
  const supabase = getSupabase();
  const status = document.querySelector('#play-status');
  const title = document.querySelector('#play-title');
  const card = document.querySelector('.status-card');
  const loader = card.querySelector('.loader');
  const progress = card.querySelector('.progress');
  const content = document.createElement('div');
  content.className = 'wedding-player-content';
  card.append(content);
  let state = null;
  let submitted = false;
  let busy = false;
  let channel;
  let timerInterval;
  let refreshInterval;
  let previousScore = null;
  let completionEffects = null;
  let completionEffectKey = '';
  let completionQuestionNumber = null;
  let podium;
  let submittedAnswerId = null;
  let previousRankPositions = new Map();
  let leaderboardElement;
  let leaderboardHeading;
  let leaderboardList;
  let leaderboardRows = new Map();
  let displayedScore = null;
  let scoreDeltaExpiresAt = 0;

  function questionIsOpen() {
    return state?.status === 'playing'
      && state.questionOpen
      && state.questionEndsAt
      && Date.parse(state.questionEndsAt) > Date.now();
  }

  document.querySelector('#play-code').textContent = code;
  document.querySelector('#play-avatar').textContent = session.avatar || '';
  title.textContent = `Bienvenue, ${session.pseudo} !`;

  function showMessage(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error-message', isError);
  }

  function renderLeaderboard() {
    if (!state?.leaderboardVisible || !state.leaderboard) {
      previousRankPositions.clear();
      return;
    }
    if (!leaderboardElement) {
      leaderboardElement = document.createElement('section');
      leaderboardElement.className = 'wedding-leaderboard';
      leaderboardElement.setAttribute('aria-label', 'Classement actualisé');
      leaderboardHeading = document.createElement('h2');
      leaderboardHeading.textContent = 'Classement';
      leaderboardList = document.createElement('ol');
      leaderboardList.className = 'wedding-leaderboard__list';
      leaderboardElement.append(leaderboardHeading, leaderboardList);
    }
    const rankIds = new Set();
    state.leaderboard.forEach((player, index) => {
      const playerId = player.id || player.pseudo;
      rankIds.add(playerId);
      let item = leaderboardRows.get(playerId);
      if (!item) {
        item = document.createElement('li');
        item.className = 'wedding-leaderboard__row';
        item.dataset.playerId = playerId;
        const entry = document.createElement('span');
        entry.className = 'wedding-leaderboard__entry';
        const name = document.createElement('span');
        const score = document.createElement('span');
        score.className = 'wedding-leaderboard__score';
        entry.append(name, score);
        item.append(entry);
        leaderboardRows.set(playerId, item);
      }
      const [name, score] = item.querySelector('.wedding-leaderboard__entry').children;
      name.textContent = `${index + 1}. ${player.pseudo}`;
      score.textContent = `${Number(player.score || 0).toLocaleString('fr-FR')} pts`;
      item.classList.toggle('is-player', player.id === session.playerId || player.pseudo === session.pseudo);
      leaderboardList.append(item);
    });
    for (const [id, item] of leaderboardRows) {
      if (!rankIds.has(id)) {
        item.remove();
        leaderboardRows.delete(id);
      }
    }
    content.append(leaderboardElement);
    animateListPositions(leaderboardList, previousRankPositions);
    previousRankPositions = new Map([...leaderboardList.children].map((item) => [
      item.dataset.playerId,
      item.getBoundingClientRect().top
    ]));
  }

  function renderCompletionEffects() {
    if (state?.questionNumber > 0 && completionEffects) {
      const streakCount = Number(completionEffects.streak) || 0;
      const streak = document.createElement('p');
      streak.className = 'wedding-player-streak';
      streak.setAttribute('role', 'status');
      if (streakCount > 0) {
        const flame = document.createElement('span');
        flame.className = 'wedding-player-streak__flame';
        flame.setAttribute('aria-hidden', 'true');
        flame.textContent = '🔥';
        flame.style.setProperty('--streak-scale', String(Math.min(1.2, 1 + Math.max(0, streakCount - 1) * 0.025)));
        const count = document.createElement('span');
        count.textContent = `${streakCount} ${streakCount === 1 ? 'bonne réponse' : 'bonnes réponses'} de suite`;
        streak.append(flame, count);
      } else {
        streak.textContent = 'Série réinitialisée';
      }
      content.append(streak);
    }

    if (state?.score === null || state?.score === undefined) return;
    const score = Number(state.score);
    const scoreChanged = previousScore !== null && score !== previousScore;
    const awardedPoints = previousScore === null ? Number(completionEffects?.awardedPoints) || 0 : 0;
    const initialScore = displayedScore === null ? score - awardedPoints : displayedScore;
    const deltaChanged = scoreChanged || (displayedScore === null && awardedPoints !== 0);
    if (deltaChanged) scoreDeltaExpiresAt = Date.now() + 900;
    const scoreDelta = deltaChanged || Date.now() < scoreDeltaExpiresAt
      ? scoreChanged ? score - initialScore : awardedPoints
      : 0;
    const scoreDisplay = document.createElement('p');
    scoreDisplay.className = 'wedding-player-score';
    scoreDisplay.setAttribute('aria-label', `Score : ${score.toLocaleString('fr-FR')} points`);
    const scoreValue = document.createElement('span');
    scoreValue.textContent = initialScore.toLocaleString('fr-FR');
    scoreDisplay.append(scoreValue);
    if (scoreDelta !== 0 && Date.now() < scoreDeltaExpiresAt) {
      const change = document.createElement('span');
      change.className = `wedding-player-score__delta ${scoreDelta > 0
        ? 'wedding-player-score__delta--gain'
        : 'wedding-player-score__delta--loss'}`;
      change.textContent = `${scoreDelta > 0 ? '+' : ''}${scoreDelta.toLocaleString('fr-FR')}`;
      scoreDisplay.append(change);
    }
    content.append(scoreDisplay);
    if (deltaChanged && !prefersReducedMotion()) {
      animateNumber(scoreValue, initialScore, score, { duration: 750 });
    } else {
      scoreValue.textContent = score.toLocaleString('fr-FR');
    }
    previousScore = score;
    displayedScore = score;
  }

  function renderFinalPodium() {
    if (!Array.isArray(state?.leaderboard)) return;
    if (!podium) {
      podium = createFinalPodium(content, {
        playerId: session.playerId,
        playerPseudo: session.pseudo
      });
    }
    podium.mount(content);
    podium.update(
      state.leaderboard,
      completionEffects?.finishedAt,
      completionEffects?.elapsedMs
    );
  }

  function render() {
    if (!state) return;
    window.clearInterval(timerInterval);
    previousRankPositions = new Map(
      [...(leaderboardList?.children || [])].map((item) => [item.dataset.playerId, item.getBoundingClientRect().top])
    );
    content.replaceChildren();
    const index = state.questionNumber || (state.questionIndex >= 0 ? state.questionIndex + 1 : 0);
    const progressBar = progress.querySelector('.progress__bar');
    const percentage = state.questionIndex < 0 ? 0 : Math.round((index / 15) * 100);
    progressBar.style.width = `${percentage}%`;
    progress.setAttribute('aria-valuenow', String(percentage));

    if (state.status === 'waiting') {
      loader.hidden = false;
      showMessage('En attente du lancement de la partie par l’organisateur…');
      renderLeaderboard();
      return;
    }
    loader.hidden = true;

    if (state.status === 'paused') {
      showMessage('La partie est en pause. Attends que l’organisateur reprenne.');
      renderQuestion(true);
      renderLeaderboard();
      return;
    }
    if (state.status === 'finished') {
      title.textContent = 'La partie est terminée !';
      showMessage('Le classement final est prêt.');
      renderQuestion(true);
      renderLeaderboard();
      renderCompletionEffects();
      renderFinalPodium();
      return;
    }

    title.textContent = `Question ${index} / 15`;
    if (questionIsOpen()) {
      showMessage(state.answered
        ? 'Réponse enregistrée. Attends la suite…'
        : 'Choisis une réponse avant la fin du temps.');
    } else if (state.question?.correctAnswerId) {
      showMessage('Question terminée. Voici la bonne réponse.');
    } else {
      showMessage('Temps écoulé. Attends la clôture de la question par l’organisateur.');
    }
    renderQuestion(!questionIsOpen());
    if (!questionIsOpen()) renderCompletionEffects();
    renderLeaderboard();
    tickTimer();
  }

  function renderQuestion(readOnly) {
    if (!state?.question) return;
    const prompt = document.createElement('h2');
    prompt.textContent = state.question.text;
    const options = document.createElement('div');
    options.className = 'wedding-answer-options';
    const deadlinePassed = !questionIsOpen();
    for (const answer of state.question.choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--secondary wedding-answer';
      button.textContent = `${answer.id}. ${answer.text}`;
      const isCorrect = state.question.correctAnswerId === answer.id;
      const revealed = Boolean(state.question.correctAnswerId && !questionIsOpen());
      const selected = completionEffects?.answerId === answer.id || submittedAnswerId === answer.id;
      if (revealed && isCorrect) button.classList.add('is-correct');
      if (revealed && selected && !isCorrect) button.classList.add('is-incorrect');
      if (selected && !revealed) button.classList.add('is-selected');
      button.disabled = readOnly || !questionIsOpen() || state.answered
        || submitted || busy || deadlinePassed;
      button.addEventListener('click', async () => {
        if (submitted || busy || button.disabled || !questionIsOpen()) return;
        submitted = true;
        busy = true;
        submittedAnswerId = answer.id;
        button.classList.add('is-submitting');
        for (const option of options.querySelectorAll('button')) option.disabled = true;
        button.setAttribute('aria-pressed', 'true');
        showMessage('Réponse enregistrée. Attends la suite…');
        try {
          await weddingAction('answer', {
            session_id: state.sessionId,
            player_id: session.playerId,
            token: session.token,
            answer_id: answer.id
          });
          void notifyWeddingGame(state.sessionId).catch((error) => {
            console.warn('Notification Realtime après réponse impossible; actualisation automatique active.', error);
          });
          showMessage('Réponse enregistrée. Attends la suite…');
          await refresh();
        } catch (error) {
          submitted = false;
          submittedAnswerId = null;
          showMessage(error.message, true);
          await refresh();
        } finally {
          busy = false;
          render();
        }
      });
      options.append(button);
    }
    content.append(prompt, options);
    if (state.question.correctAnswerId && !questionIsOpen()) {
      const answer = document.createElement('p');
      answer.className = 'status-message';
      const correct = state.question.choices.find((choice) => choice.id === state.question.correctAnswerId);
      answer.textContent = `Bonne réponse : ${correct?.text || state.question.correctAnswerId}`;
      content.append(answer);
    }
  }

  function tickTimer() {
    if (!state?.questionOpen || !state.questionEndsAt || state.status === 'paused') return;
    const timer = document.createElement('p');
    timer.className = 'wedding-player-timer';
    const remaining = Math.max(0, Math.ceil((Date.parse(state.questionEndsAt) - Date.now()) / 1000));
    timer.textContent = remaining > 0 ? `Temps restant : ${remaining} s` : 'Temps écoulé…';
    if (remaining === 0) {
      for (const button of content.querySelectorAll('.wedding-answer')) button.disabled = true;
      showMessage('Temps écoulé. La réponse sera révélée par l’organisateur.');
      void refresh();
    }
    content.append(timer);
    if (remaining > 0) timerInterval = window.setTimeout(() => {
      timer.remove();
      tickTimer();
    }, 250);
  }

  async function refresh() {
    if (busy) return;
    try {
      state = await weddingAction('player_state', {
        session_id: session.sessionId,
        player_id: session.playerId,
        token: session.token
      });
      submitted = state.answered;
      const questionNumber = Number(state.questionNumber) || 0;
      if (completionQuestionNumber !== null && completionQuestionNumber !== questionNumber) {
        completionEffects = null;
        completionEffectKey = '';
        submittedAnswerId = null;
      }
      completionQuestionNumber = questionNumber;
      const resultVisible = Boolean(state.status === 'finished'
        || (state.status !== 'waiting' && state.status !== 'paused'
          && (!state.questionOpen || Date.parse(state.questionEndsAt || '') <= Date.now())));
      if (resultVisible && questionNumber > 0) {
        const effectKey = `${state.status}:${questionNumber}:${state.answered}`;
        if (effectKey !== completionEffectKey) {
          completionEffects = await weddingAnimationState({
            session_id: session.sessionId,
            player_id: session.playerId,
            token: session.token
          });
          completionEffectKey = effectKey;
          submittedAnswerId = completionEffects.answerId || submittedAnswerId;
          if (Array.isArray(completionEffects.leaderboard)) {
            state.leaderboard = completionEffects.leaderboard;
          }
          if (completionEffects.score !== undefined && completionEffects.score !== null) {
            state.score = completionEffects.score;
          }
        }
      }
      render();
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  channel = subscribeToWeddingGame(
    session.sessionId,
    () => refresh().catch((error) => showMessage(error.message, true)),
    () => {}
  );
  const channelHandle = channel.channel;
  channel.ready.then(() => channelHandle.track({ playerId: session.playerId }))
    .catch((error) => {
      console.warn('Synchronisation temps réel indisponible; actualisation automatique active.', error);
      showMessage('Connexion Realtime indisponible. La partie sera actualisée automatiquement.', true);
    });
  await refresh();
  refreshInterval = window.setInterval(() => {
    refresh().catch((error) => showMessage(error.message, true));
  }, 2000);
  window.addEventListener('beforeunload', () => {
    window.clearInterval(refreshInterval);
    window.clearTimeout(timerInterval);
    channelHandle.unsubscribe();
  }, { once: true });
}
