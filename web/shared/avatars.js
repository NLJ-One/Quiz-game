export const ANIMAL_AVATARS = Object.freeze([
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉',
  '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
  '🐢', '🐍', '🦎', '🐙', '🦀', '🐬', '🐳', '🦈', '🦭', '🐘'
]);

export function normalizeAvatarIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < ANIMAL_AVATARS.length ? value : 0;
}
