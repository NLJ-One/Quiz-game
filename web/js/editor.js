import { ensureDefaultQuiz, list } from './shared/quizStore.js';

const status = document.createElement('p');
status.setAttribute('role', 'status');
document.querySelector('main').append(status);

try {
  await ensureDefaultQuiz();
  status.textContent = `${list().length} quiz prêt(s) dans ce navigateur.`;
} catch (error) {
  status.setAttribute('role', 'alert');
  status.textContent = error.message;
}
