export function normalizeText(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSpeedMultiplier(question, settings = {}) {
  const settingsForQuestion = settings ?? {};
  const pointsMode = question?.points ?? 'standard';
  if (pointsMode === 'double') return 2;
  if (pointsMode === 'none') return 0;
  return settingsForQuestion.pointsMultiplier ?? 1;
}

function applyStreakBonus(streak = 0, settings = {}) {
  const enabled = settings.streakBonus !== false;
  if (!enabled) return 0;
  return Math.min(Number(streak || 0) * 100, 500);
}

export function computeScore(question, answer, timeLeftRatio = 1, settings = {}, streak = 0) {
  if (!question || typeof question !== 'object') return 0;

  const base = Number(settings.pointsBase || 1000);
  const speedEnabled = settings.speedBonus !== false;
  const speedFactor = speedEnabled ? 0.5 + 0.5 * Math.max(0, Math.min(1, Number(timeLeftRatio) || 0)) : 1;
  const multiplier = getSpeedMultiplier(question, settings);
  const bonus = applyStreakBonus(streak, settings);

  const type = question.type;

  if (type === 'poll') return 0;

  if (type === 'single' || type === 'truefalse' || type === 'order') {
    const expected = Array.isArray(question.correctAnswer)
      ? question.correctAnswer[0]
      : question.correctAnswer;
    const isCorrect = JSON.stringify(answer) === JSON.stringify(expected);
    if (!isCorrect) return 0;
    return Math.max(0, Math.round(base * multiplier * speedFactor + bonus));
  }

  if (type === 'multiple') {
    const expected = Array.isArray(question.correctAnswers) ? question.correctAnswers : [];
    const selected = Array.isArray(answer) ? answer : [];
    if (!expected.length) return 0;

    const correctCount = expected.filter((item) => selected.includes(item)).length;
    const wrongCount = selected.filter((item) => !expected.includes(item)).length;
    const ratio = Math.max(0, (correctCount - wrongCount * 0.5) / expected.length);
    return Math.max(0, Math.round(base * multiplier * speedFactor * ratio + bonus));
  }

  if (type === 'slider') {
    const target = Number(question.correctValue ?? question.correctAnswer ?? 0);
    const value = Number(answer ?? 0);
    const tolerance = Number(question.tolerance ?? 0);
    const diff = Math.abs(value - target);
    const maxDistance = Math.max(1, Number(question.max ?? target + tolerance + 1) - Number(question.min ?? target - tolerance - 1));
    const quality = Math.max(0, 1 - diff / Math.max(1, maxDistance));
    return Math.max(0, Math.round(base * multiplier * quality + bonus));
  }

  if (type === 'text') {
    const accepted = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];
    const normalizedAnswer = normalizeText(answer);
    if (!normalizedAnswer) return 0;
    const isCorrect = accepted.some((option) => normalizeText(option) === normalizedAnswer);
    if (!isCorrect) return 0;
    return Math.max(0, Math.round(base * multiplier * speedFactor + bonus));
  }

  return 0;
}
