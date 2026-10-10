import { animateNumber, prefersReducedMotion } from '/js/shared/game-animations.js';
import { ANIMAL_AVATARS, normalizeAvatarIndex } from '/shared/avatars.js';

const REVEAL_TIMES = {
  third: 900,
  second: 1900,
  suspense: 3000,
  winner: 5000,
  complete: 6500
};

function makePodiumPlace(place, label, medalClass) {
  const wrapper = document.createElement('div');
  wrapper.className = `podium-place podium-place--${place}`;
  wrapper.dataset.place = place;

  const player = document.createElement('div');
  player.className = 'podium-player';
  player.hidden = true;

  const column = document.createElement('div');
  column.className = 'podium-column';
  const medal = document.createElement('span');
  medal.className = `medal ${medalClass}`;
  medal.textContent = label;
  const identity = document.createElement('span');
  identity.className = 'final-podium__identity';
  const score = document.createElement('span');
  score.className = 'podium-column__score';
  const detail = document.createElement('span');
  detail.className = 'podium-column__detail';
  column.append(medal, identity, score, detail);
  wrapper.append(player, column);
  return wrapper;
}

function createParticleField() {
  const field = document.createElement('span');
  field.className = 'final-podium__particles';
  field.setAttribute('aria-hidden', 'true');
  if (prefersReducedMotion() || navigator.connection?.saveData) return field;
  const colors = ['#22a06b', '#b7f34d', '#f4c430', '#ffffff', '#ff7f6f'];

  for (let index = 0; index < 14; index += 1) {
    const particle = document.createElement('i');
    particle.style.setProperty('--particle-delay', `${index * 16}ms`);
    particle.style.setProperty('--particle-x', `${(index - 6.5) * 0.7}rem`);
    particle.style.backgroundColor = colors[index % colors.length];
    field.append(particle);
  }
  return field;
}

export function createFinalPodium(container, { playerId = '', playerPseudo = '' } = {}) {
  const section = document.createElement('section');
  section.className = 'final-podium';
  section.setAttribute('aria-labelledby', 'final-podium-title');

  const title = document.createElement('h2');
  title.id = 'final-podium-title';
  title.textContent = 'Le classement final';
  const announcement = document.createElement('p');
  announcement.className = 'final-podium__announcement';
  announcement.setAttribute('aria-live', 'polite');
  announcement.textContent = 'Découvrons les trois premiers…';

  const podium = document.createElement('div');
  podium.className = 'podium final-podium__places';
  podium.setAttribute('aria-label', 'Podium des trois premiers');
  const second = makePodiumPlace('second', '2e', 'medal--silver');
  const first = makePodiumPlace('first', '1er', 'medal--gold');
  const third = makePodiumPlace('third', '3e', 'medal--bronze');
  const questionMark = document.createElement('span');
  questionMark.className = 'final-podium__question-mark';
  questionMark.textContent = '?';
  questionMark.setAttribute('aria-label', 'Identité masquée');
  first.querySelector('.podium-column').prepend(createParticleField(), questionMark);
  podium.append(second, first, third);

  const completeButton = document.createElement('button');
  completeButton.type = 'button';
  completeButton.className = 'btn btn--secondary final-podium__full-button';
  completeButton.textContent = 'Voir le classement complet';
  completeButton.hidden = true;
  const fullList = document.createElement('ol');
  fullList.className = 'final-podium__full-list';
  fullList.hidden = true;
  fullList.setAttribute('aria-label', 'Classement complet');
  completeButton.addEventListener('click', () => {
    const expanded = fullList.hidden;
    fullList.hidden = !expanded;
    completeButton.setAttribute('aria-expanded', String(expanded));
    if (expanded) completeButton.textContent = 'Masquer le classement complet';
    else completeButton.textContent = 'Voir le classement complet';
  });

  section.append(title, announcement, podium, completeButton, fullList);
  container.append(section);

  let standings = [];
  let finishedAt = null;
  let timer;
  let drawnPhase = -1;
  let fullListKey = '';

  function renderPlace(element, participant, visible, masked = false) {
    const player = element.querySelector('.podium-player');
    const identity = element.querySelector('.final-podium__identity');
    const score = element.querySelector('.podium-column__score');
    const detail = element.querySelector('.podium-column__detail');
    const column = element.querySelector('.podium-column');
    const avatarIndex = participant?.avatarIndex;

    if (!visible) {
      element.hidden = true;
      return;
    }
    element.hidden = false;
    if (masked || !participant) {
      player.hidden = true;
      identity.textContent = '';
      score.textContent = '';
      detail.textContent = '';
      const questionMark = element.querySelector('.final-podium__question-mark');
      if (questionMark) questionMark.hidden = false;
      element.classList.add('is-masked');
      column.setAttribute('aria-label', 'Première place, identité masquée');
      return;
    }

    const previousName = player.dataset.pseudo || '';
    player.hidden = false;
    player.replaceChildren();
    if (Number.isInteger(avatarIndex)) {
      const avatar = document.createElement('span');
      avatar.className = 'podium-player__avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = ANIMAL_AVATARS[normalizeAvatarIndex(avatarIndex)];
      player.append(avatar);
    }
    player.dataset.pseudo = participant.pseudo;
    const questionMark = element.querySelector('.final-podium__question-mark');
    if (questionMark) questionMark.hidden = true;
    identity.textContent = participant.pseudo;
    const scoreValue = Number(participant.score) || 0;
    if (score.dataset.value !== String(scoreValue)) {
      score.dataset.value = String(scoreValue);
      animateNumber(score, 0, scoreValue, { duration: 850 });
    }
    detail.textContent = `${scoreValue.toLocaleString('fr-FR')} points`;
    element.classList.remove('is-masked');
    if (!previousName) element.classList.add('is-revealed');
    if (element.dataset.place === 'first') {
      column.setAttribute('aria-label', `Première place : ${participant.pseudo}`);
    }
  }

  function renderFullList() {
    const listKey = standings.map((player, index) => (
      `${index}:${player.pseudo}:${player.score}`
    )).join('|');
    if (listKey === fullListKey) return;
    fullListKey = listKey;
    fullList.replaceChildren();
    for (const [index, participant] of standings.entries()) {
      const item = document.createElement('li');
      item.dataset.playerId = participant.id || participant.pseudo;
      item.classList.toggle('is-player', Boolean(
        (playerId && participant.id === playerId)
        || (playerPseudo && participant.pseudo === playerPseudo)
      ));
      const rank = document.createElement('span');
      rank.className = 'final-podium__rank';
      rank.textContent = `${index + 1}.`;
      const name = document.createElement('span');
      name.textContent = participant.pseudo;
      const score = document.createElement('span');
      score.textContent = `${Number(participant.score || 0).toLocaleString('fr-FR')} pts`;
      item.append(rank, name, score);
      fullList.append(item);
    }
  }

  function draw() {
    window.clearTimeout(timer);
    if (!finishedAt) {
      announcement.textContent = 'Synchronisation du classement final…';
      return;
    }
    const elapsed = Math.max(0, Date.now() - finishedAt);
    let phase = 0;
    if (elapsed >= REVEAL_TIMES.third) phase = 1;
    if (elapsed >= REVEAL_TIMES.second) phase = 2;
    if (elapsed >= REVEAL_TIMES.suspense) phase = 3;
    if (elapsed >= REVEAL_TIMES.winner) phase = 4;
    if (elapsed >= REVEAL_TIMES.complete) phase = 5;

    if (phase !== drawnPhase) {
      const winner = standings[0];
      announcement.textContent = phase >= 4 && winner
        ? `Félicitations à ${winner.pseudo} !`
        : phase >= 3 && winner ? 'Et à la première place…'
          : phase >= 3 ? 'Le classement final est terminé.' : 'Découvrons les trois premiers…';
      if (phase < 1) {
        renderPlace(third, standings[2], false);
        renderPlace(second, standings[1], false);
        renderPlace(first, null, false);
      } else {
        renderPlace(third, standings[2], true);
        renderPlace(second, standings[1], phase >= 2);
        renderPlace(first, phase >= 3 ? standings[0] : null, phase >= 3 && Boolean(standings[0]), phase < 4);
      }
      completeButton.hidden = phase < 5;
      if (phase >= 4 && phase < 5 && standings[0]) {
        const particles = first.querySelector('.final-podium__particles');
        if (particles.childElementCount) particles.classList.add('is-active');
      }
      if (phase >= 5) {
        renderFullList();
      }
      drawnPhase = phase;
    }

    const nextTime = Object.values(REVEAL_TIMES).find((time) => time > elapsed);
    if (nextTime !== undefined) {
      timer = window.setTimeout(draw, Math.max(0, nextTime - elapsed));
    }
  }

  return {
    mount(target) {
      if (section.parentElement !== target) target.append(section);
    },
    update(nextStandings, timestamp, elapsedMs) {
      standings = Array.isArray(nextStandings) ? nextStandings : [];
      const parsedTime = Date.parse(timestamp || '');
      const synchronizedElapsed = Number(elapsedMs);
      finishedAt = Number.isFinite(synchronizedElapsed)
        ? Date.now() - Math.max(0, synchronizedElapsed)
        : Number.isFinite(parsedTime) ? parsedTime : null;
      if (finishedAt && drawnPhase >= 0) {
        const elapsed = Math.max(0, Date.now() - finishedAt);
        const phase = Object.values(REVEAL_TIMES).filter((time) => elapsed >= time).length;
        if (phase !== drawnPhase) draw();
      } else {
        draw();
      }
    },
    destroy() {
      window.clearTimeout(timer);
      section.remove();
    }
  };
}
