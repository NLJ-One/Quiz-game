import { getSupabase, subscribeToWeddingGame, weddingAction } from '/js/shared/supabase.js';

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
    if (!state?.leaderboardVisible || !state.leaderboard) return;
    const heading = document.createElement('h2');
    heading.textContent = 'Classement';
    const list = document.createElement('ol');
    for (const player of state.leaderboard) {
      const item = document.createElement('li');
      item.textContent = `${player.pseudo} — ${player.score} pts`;
      list.append(item);
    }
    content.append(heading, list);
  }

  function render() {
    if (!state) return;
    window.clearInterval(timerInterval);
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
      showMessage(`Ton score : ${state.score} points.`);
      renderQuestion(true);
      renderLeaderboard();
      return;
    }

    title.textContent = `Question ${index} / 15`;
    if (questionIsOpen()) {
      showMessage(state.answered
        ? 'Réponse enregistrée. Attends la suite…'
        : 'Choisis une réponse avant la fin du temps.');
    } else {
      showMessage('Question terminée. Voici la bonne réponse.');
    }
    renderQuestion(!questionIsOpen());
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
      button.textContent = answer.text;
      const isCorrect = state.question.correctAnswerId === answer.id;
      if (state.question.correctAnswerId && isCorrect) button.classList.add('is-correct');
      button.disabled = readOnly || !questionIsOpen() || state.answered
        || submitted || busy || deadlinePassed;
      button.addEventListener('click', async () => {
        submitted = true;
        busy = true;
        render();
        try {
          await weddingAction('answer', {
            session_id: state.sessionId,
            player_id: session.playerId,
            token: session.token,
            answer_id: answer.id
          });
          showMessage('Réponse enregistrée. Attends la suite…');
          await refresh();
        } catch (error) {
          submitted = false;
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
