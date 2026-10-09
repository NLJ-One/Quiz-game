import '/js/config.js';
import { TEXTS } from '/shared/texts.fr.js';
import { ANIMAL_AVATARS, normalizeAvatarIndex } from '/shared/avatars.js';
import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { applyTheme } from '/js/shared/theme.js';
import { isSupabaseConfigured, notifyWeddingGame, weddingAction } from '/js/shared/supabase.js';

const PLAYER_SESSION_KEY = 'weddingquiz.playerSession';
const form = document.querySelector('#join-form');
const status = document.querySelector('#join-status');
const codeInput = document.querySelector('#room-code');
const nicknameInput = document.querySelector('#player-nickname');
const codeStep = document.querySelector('#join-step-code');
const playerStep = document.querySelector('#join-step-player');
const avatarOptions = document.querySelector('#avatar-options');
const wordmark = document.querySelector('#join-wordmark');
let selectedAvatarIndex = Math.floor(Math.random() * ANIMAL_AVATARS.length);

applyTheme(WEDDING_CONFIG);
wordmark.textContent = WEDDING_CONFIG.coupleNames;

const requestedCode = new URLSearchParams(location.search).get('code');
if (requestedCode) codeInput.value = requestedCode.replace(/\D/g, '').slice(0, 6);

function selectAvatar(index) {
  selectedAvatarIndex = index;
  for (const option of avatarOptions.querySelectorAll('.avatar-choice')) {
    const isSelected = Number(option.dataset.avatarIndex) === index;
    option.setAttribute('aria-checked', String(isSelected));
    option.tabIndex = isSelected ? 0 : -1;
    option.classList.toggle('is-selected', isSelected);
  }
}

ANIMAL_AVATARS.forEach((emoji, index) => {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'avatar-choice';
  option.dataset.avatarIndex = String(index);
  option.setAttribute('role', 'radio');
  option.setAttribute('aria-label', `Animal ${index + 1} ${emoji}`);
  option.textContent = emoji;
  option.addEventListener('click', () => selectAvatar(index));
  option.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
    const nextIndex = (index + direction + ANIMAL_AVATARS.length) % ANIMAL_AVATARS.length;
    selectAvatar(nextIndex);
    avatarOptions.querySelector(`[data-avatar-index="${nextIndex}"]`).focus();
  });
  avatarOptions.append(option);
});
selectAvatar(selectedAvatarIndex);

document.querySelector('#continue-join').addEventListener('click', async (event) => {
  if (!/^\d{6}$/.test(codeInput.value.trim())) {
    status.textContent = TEXTS.roomCodeInvalid;
    status.classList.add('error-message');
    codeInput.focus();
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  status.classList.remove('error-message');
  status.textContent = TEXTS.loading;
  try {
    if (!isSupabaseConfigured()) throw new Error('La connexion Supabase n’est pas configurée sur ce site.');
    const game = await weddingAction('lookup', { code: codeInput.value.trim() });
    if (!game?.found) throw new Error('Aucune salle en attente ne correspond à ce code.');
    status.textContent = game.title;
  } catch (error) {
    status.textContent = error.message || 'Impossible de trouver cette partie.';
    status.classList.add('error-message');
    button.disabled = false;
    return;
  }
  codeStep.hidden = true;
  playerStep.hidden = false;
  nicknameInput.focus();
  button.disabled = false;
});

document.querySelector('#back-to-code').addEventListener('click', () => {
  playerStep.hidden = true;
  codeStep.hidden = false;
  codeInput.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = codeInput.value.trim();
  const pseudo = nicknameInput.value.trim();

  if (!/^\d{6}$/.test(code)) {
    playerStep.hidden = true;
    codeStep.hidden = false;
    status.textContent = TEXTS.roomCodeInvalid;
    status.classList.add('error-message');
    codeInput.focus();
    return;
  }
  if (pseudo.length < 2 || pseudo.length > 20) {
    status.textContent = TEXTS.nicknameInvalid;
    status.classList.add('error-message');
    nicknameInput.focus();
    return;
  }

  status.classList.remove('error-message');
  status.textContent = TEXTS.loading;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    if (!isSupabaseConfigured()) throw new Error('La connexion Supabase n’est pas configurée sur ce site.');
    const player = await weddingAction('join', {
      code,
      pseudo,
      avatar_index: normalizeAvatarIndex(selectedAvatarIndex)
    });
    if (!player?.joined || !player.sessionId || !player.playerId || !player.token) {
      throw new Error('Supabase n’a pas confirmé ton inscription à la salle.');
    }
    localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({
      code,
      pseudo,
      playerId: player.playerId,
      sessionId: player.sessionId,
      token: player.token,
      avatarIndex: normalizeAvatarIndex(selectedAvatarIndex),
      avatar: ANIMAL_AVATARS[normalizeAvatarIndex(selectedAvatarIndex)]
    }));
    void notifyWeddingGame(player.sessionId).catch((error) => {
      console.warn('Notification Realtime après inscription impossible; la salle sera actualisée automatiquement.', error);
    });
    location.assign(`/play.html?code=${encodeURIComponent(code)}`);
  } catch (error) {
    status.textContent = error.message || 'Impossible de rejoindre cette partie.';
    status.classList.add('error-message');
    submit.disabled = false;
  }
});
