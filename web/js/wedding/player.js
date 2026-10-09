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
    content.replaceChildren();
    const index = state.questionIndex + 1;
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
      renderQuestion(false);
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
    if (state.questionOpen) {
      showMessage(state.answered
        ? 'Réponse enregistrée. Attends la suite…'
        : 'Choisis une réponse avant la fin du temps.');
    } else {
      showMessage('Question terminée. Voici la bonne réponse.');
    }
    renderQuestion(false);
    renderLeaderboard();
    tickTimer();
  }

  function renderQuestion(readOnly) {
    if (!state?.question) return;
    const prompt = document.createElement('h2');
    prompt.textContent = state.question.text;
    const options = document.createElement('div');
    options.className = 'wedding-answer-options';
    for (const answer of state.question.choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--secondary wedding-answer';
      button.textContent = answer;
      const isCorrect = state.question.correctAnswer === answer;
      if (state.question.correctAnswer && isCorrect) button.classList.add('is-correct');
      button.disabled = readOnly || !state.questionOpen || state.answered || submitted || busy;
      button.addEventListener('click', async () => {
        submitted = true;
        busy = true;
        render();
        try {
          await weddingAction('answer', {
            session_id: state.sessionId,
            player_id: session.playerId,
            token: session.token,
            answer
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
    if (state.question.correctAnswer && !state.questionOpen) {
      const answer = document.createElement('p');
      answer.className = 'status-message';
      answer.textContent = `Bonne réponse : ${state.question.correctAnswer}`;
      content.append(answer);
    }
  }

  function tickTimer() {
    if (!state?.questionOpen || !state.questionEndsAt) return;
    const timer = document.createElement('p');
    timer.className = 'wedding-player-timer';
    const remaining = Math.max(0, Math.ceil((Date.parse(state.questionEndsAt) - Date.now()) / 1000));
    timer.textContent = remaining > 0 ? `Temps restant : ${remaining} s` : 'Temps écoulé…';
    content.append(timer);
    if (remaining > 0) window.setTimeout(() => {
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
    () => refresh(),
    () => {}
  );
  channel.subscribe((channelStatus) => {
    if (channelStatus === 'SUBSCRIBED') {
      channel.track({ playerId: session.playerId });
    }
  });
  await refresh();
  window.setInterval(() => refresh(), 3000);
  window.setInterval(() => {
    weddingAction('heartbeat', {
      session_id: session.sessionId,
      player_id: session.playerId,
      token: session.token
    }).catch((error) => showMessage(error.message, true));
  }, 20000);
  window.addEventListener('beforeunload', () => channel.unsubscribe(), { once: true });
}
