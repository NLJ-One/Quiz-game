const activeAnimations = new WeakMap();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function animateNumber(element, from, to, {
  duration = 750,
  format = (value) => Math.round(value).toLocaleString('fr-FR')
} = {}) {
  const previousFrame = activeAnimations.get(element);
  if (previousFrame) cancelAnimationFrame(previousFrame);
  if (reducedMotion.matches || from === to) {
    element.textContent = format(to);
    activeAnimations.delete(element);
    return;
  }

  const startedAt = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = format(from + (to - from) * eased);
    if (progress < 1) {
      activeAnimations.set(element, requestAnimationFrame(step));
    } else {
      activeAnimations.delete(element);
    }
  }
  activeAnimations.set(element, requestAnimationFrame(step));
}

export function animateListPositions(container, previousPositions, duration = 520) {
  if (reducedMotion.matches) return;
  for (const row of container.children) {
    const previousTop = previousPositions.get(row.dataset.playerId);
    if (previousTop === undefined) continue;
    const offset = previousTop - row.getBoundingClientRect().top;
    if (offset === 0) continue;
    row.animate(
      [{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }],
      { duration, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' }
    );
  }
}

export function prefersReducedMotion() {
  return reducedMotion.matches;
}
