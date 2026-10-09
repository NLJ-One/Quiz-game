import '/js/config.js';
import '/shared/texts.fr.js';
import { ANIMAL_AVATARS } from '/shared/avatars.js';
import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { applyTheme } from '/js/shared/theme.js';

applyTheme(WEDDING_CONFIG);
document.querySelector('#dev-wordmark').textContent = WEDDING_CONFIG.coupleNames;

const countInput = document.querySelector('#player-count');
const countOutput = document.querySelector('#player-count-value');
const scoreboard = document.querySelector('#demo-scoreboard');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const players = Array.from({ length: 100 }, (_, index) => ({
  id: `player-${index + 1}`,
  nickname: index === 0 ? 'Noah' : `Invité ${String(index + 1).padStart(2, '0')}`,
  avatarIndex: index % ANIMAL_AVATARS.length,
  score: (100 - index) * 120
}));
let visibleCount = Number(countInput.value);

function formatScore(score) {
  return `${score.toLocaleString('fr-FR')} pts`;
}

function createScoreRow(player, rank) {
  const row = document.createElement('li');
  row.className = 'scoreboard-row';
  row.dataset.playerId = player.id;

  const position = document.createElement('span');
  position.className = 'scoreboard-row__rank';
  position.setAttribute('aria-label', `Rang ${rank}`);

  const avatar = document.createElement('span');
  avatar.className = 'scoreboard-row__avatar';
  avatar.setAttribute('aria-hidden', 'true');

  const nickname = document.createElement('span');
  nickname.className = 'scoreboard-row__name';

  const score = document.createElement('span');
  score.className = 'scoreboard-row__score';

  row.append(position, avatar, nickname, score);
  return row;
}

function renderLeaderboard({ animate = false, changedPlayerId = '' } = {}) {
  const visiblePlayers = players.slice(0, visibleCount);
  const oldPositions = new Map();
  if (animate && !reducedMotion.matches) {
    for (const row of scoreboard.children) {
      if (oldPositions.size < 10) oldPositions.set(row.dataset.playerId, row.getBoundingClientRect().top);
    }
  }

  for (const [index, player] of visiblePlayers.entries()) {
    let row = scoreboard.querySelector(`[data-player-id="${player.id}"]`);
    if (!row) row = createScoreRow(player, index + 1);
    const [position, avatar, nickname, score] = row.children;
    position.textContent = String(index + 1);
    position.setAttribute('aria-label', `Rang ${index + 1}`);
    avatar.textContent = ANIMAL_AVATARS[player.avatarIndex];
    nickname.textContent = player.nickname;
    score.textContent = formatScore(player.score);
    row.classList.toggle('is-rising', player.id === changedPlayerId);
    scoreboard.append(row);
  }

  const displayedIds = new Set(visiblePlayers.map((player) => player.id));
  for (const row of [...scoreboard.children]) {
    if (!displayedIds.has(row.dataset.playerId)) row.remove();
  }

  if (animate && !reducedMotion.matches) {
    let animatedRows = 0;
    for (const row of scoreboard.children) {
      const previousTop = oldPositions.get(row.dataset.playerId);
      if (previousTop === undefined || animatedRows >= 10) continue;
      const offset = previousTop - row.getBoundingClientRect().top;
      if (offset === 0) continue;
      row.animate(
        [{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }],
        { duration: 600, easing: 'ease-out' }
      );
      animatedRows += 1;
    }
  }
}

countInput.addEventListener('input', () => {
  visibleCount = Number(countInput.value);
  countOutput.value = String(visibleCount);
  renderLeaderboard();
});

document.querySelector('#shuffle-players').addEventListener('click', () => {
  const risingPlayer = players.splice(3, 1)[0];
  const previousScore = risingPlayer.score;
  risingPlayer.score += 500;
  players.unshift(risingPlayer);
  renderLeaderboard({ animate: true, changedPlayerId: risingPlayer.id });

  if (!reducedMotion.matches) {
    const score = scoreboard.querySelector(`[data-player-id="${risingPlayer.id}"] .scoreboard-row__score`);
    const startedAt = performance.now();
    const duration = 600;
    function countUp(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const value = Math.round(previousScore + (risingPlayer.score - previousScore) * progress);
      score.textContent = formatScore(value);
      if (progress < 1) requestAnimationFrame(countUp);
    }
    requestAnimationFrame(countUp);
  }
});

const motionStatus = document.querySelector('#motion-status');
document.querySelector('#confetti-button').addEventListener('click', () => {
  const savingData = navigator.connection?.saveData === true;
  if (reducedMotion.matches || savingData) {
    motionStatus.textContent = savingData
      ? 'Confettis désactivés en mode économie de données.'
      : 'Confettis désactivés selon ta préférence de mouvement réduit.';
    return;
  }
  if (typeof globalThis.confetti !== 'function') {
    motionStatus.textContent = 'Le module local de confettis n’a pas pu être chargé.';
    return;
  }
  motionStatus.textContent = 'Bravo !';
  globalThis.confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 35,
    origin: { y: 0.65 },
    colors: ['#22a06b', '#b7f34d', '#f4c430', '#ffffff', '#ff7f6f'],
    disableForReducedMotion: true
  });
});

renderLeaderboard();
