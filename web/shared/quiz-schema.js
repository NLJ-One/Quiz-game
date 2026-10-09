const DEFAULT_QUESTION = {
  id: '',
  type: 'single',
  text: '',
  media: '',
  duration: 30,
  points: 'standard',
  choices: [],
  correctAnswer: null,
  acceptedAnswers: [],
  order: [],
  explanation: '',
  tolerance: 0,
  correctValue: 0,
  min: 0,
  max: 100,
  step: 1
};

export const defaultSettings = {
  shuffleQuestions: false,
  shuffleAnswers: false,
  pointsBase: 1000,
  speedBonus: true,
  streakBonus: true,
  showCorrectAnswer: true,
  showLeaderboardAfterEachQuestion: true,
  leaderboardSize: 5,
  autoAdvance: true,
  delayBeforeNext: 3,
  maxPlayers: 150,
  allowLateJoin: true,
  nicknameFilter: 'none',
  uniqueNicknames: true,
  teamMode: 'off',
  tables: [],
  lobbyMusic: false,
  soundEffects: true,
  showQRCode: false
};

export function newQuestion(type = 'single') {
  const base = {
    ...DEFAULT_QUESTION,
    id: `q-${Math.random().toString(36).slice(2, 10)}`,
    type,
    text: 'Nouvelle question',
    duration: 30,
    points: 'standard',
    explanation: ''
  };

  switch (type) {
    case 'single':
      return {
        ...base,
        choices: ['Réponse 1', 'Réponse 2', 'Réponse 3', 'Réponse 4'],
        correctAnswer: 'Réponse 1'
      };
    case 'multiple':
      return {
        ...base,
        choices: ['Réponse 1', 'Réponse 2', 'Réponse 3', 'Réponse 4'],
        correctAnswers: ['Réponse 1', 'Réponse 2']
      };
    case 'truefalse':
      return {
        ...base,
        choices: ['Vrai', 'Faux'],
        correctAnswer: 'Vrai'
      };
    case 'slider':
      return {
        ...base,
        min: 0,
        max: 100,
        step: 1,
        correctValue: 50,
        tolerance: 5
      };
    case 'text':
      return {
        ...base,
        acceptedAnswers: ['réponse attendue'],
        explanation: ''
      };
    case 'poll':
      return {
        ...base,
        points: 'none',
        choices: ['Option 1', 'Option 2', 'Option 3']
      };
    case 'order':
      return {
        ...base,
        order: ['Première', 'Deuxième', 'Troisième', 'Quatrième'],
        correctAnswer: ['Première', 'Deuxième', 'Troisième', 'Quatrième']
      };
    default:
      return base;
  }
}

function addError(errors, message) {
  if (!errors.includes(message)) {
    errors.push(message);
  }
}

function validateQuestion(question, errors, index) {
  if (!question || typeof question !== 'object') {
    addError(errors, `La question ${index + 1} est invalide.`);
    return;
  }

  if (!question.id) {
    addError(errors, `La question ${index + 1} manque d'identifiant.`);
  }

  if (!question.text || typeof question.text !== 'string') {
    addError(errors, `La question ${index + 1} doit contenir un texte.`);
  }

  if (!Number.isInteger(question.duration) || question.duration < 5 || question.duration > 120) {
    addError(errors, `La question ${index + 1} doit avoir une durée entre 5 et 120 secondes.`);
  }

  if (!['single', 'multiple', 'truefalse', 'slider', 'text', 'poll', 'order'].includes(question.type)) {
    addError(errors, `La question ${index + 1} a un type invalide.`);
  }

  const validPoints = ['standard', 'double', 'none'];
  if (question.points && !validPoints.includes(question.points)) {
    addError(errors, `La question ${index + 1} a un type de points invalide.`);
  }

  switch (question.type) {
    case 'single':
    case 'truefalse':
      if (!Array.isArray(question.choices) || question.choices.length < 2 || question.choices.length > 4) {
        addError(errors, `La question ${index + 1} doit avoir entre 2 et 4 choix.`);
      }
      if (question.correctAnswer === undefined || question.correctAnswer === null) {
        addError(errors, `La question ${index + 1} doit définir une bonne réponse.`);
      }
      break;
    case 'multiple':
      if (!Array.isArray(question.choices) || question.choices.length < 2 || question.choices.length > 6) {
        addError(errors, `La question ${index + 1} doit avoir entre 2 et 6 choix.`);
      }
      if (!Array.isArray(question.correctAnswers) || question.correctAnswers.length === 0) {
        addError(errors, `La question ${index + 1} doit définir au moins une bonne réponse.`);
      }
      break;
    case 'slider':
      if (!Number.isFinite(Number(question.min)) || !Number.isFinite(Number(question.max))) {
        addError(errors, `La question ${index + 1} doit définir un min et un max numériques.`);
      }
      if (!Number.isFinite(Number(question.correctValue))) {
        addError(errors, `La question ${index + 1} doit définir une valeur exacte.`);
      }
      if (!Number.isFinite(Number(question.tolerance)) || Number(question.tolerance) < 0) {
        addError(errors, `La question ${index + 1} doit avoir une tolérance valide.`);
      }
      break;
    case 'text':
      if (!Array.isArray(question.acceptedAnswers) || question.acceptedAnswers.length === 0) {
        addError(errors, `La question ${index + 1} doit définir au moins une réponse acceptée.`);
      }
      break;
    case 'poll':
      if (!Array.isArray(question.choices) || question.choices.length < 2) {
        addError(errors, `La question ${index + 1} doit proposer au moins deux options.`);
      }
      break;
    case 'order':
      if (!Array.isArray(question.order) || question.order.length !== 4) {
        addError(errors, `La question ${index + 1} doit avoir 4 éléments à remettre dans l'ordre.`);
      }
      if (!Array.isArray(question.correctAnswer) || question.correctAnswer.length !== 4) {
        addError(errors, `La question ${index + 1} doit définir un ordre correct.`);
      }
      break;
    default:
      break;
  }
}

export function validateQuiz(quiz) {
  const errors = [];

  if (!quiz || typeof quiz !== 'object') {
    return { valid: false, errors: ['Le quiz n\'est pas un objet valide.'] };
  }

  if (!quiz.id || typeof quiz.id !== 'string') {
    addError(errors, 'Le quiz doit avoir un identifiant.' );
  }

  if (!quiz.title || typeof quiz.title !== 'string') {
    addError(errors, 'Le quiz doit avoir un titre.');
  }

  if (quiz.description !== undefined && typeof quiz.description !== 'string') {
    addError(errors, 'La description du quiz doit être une chaîne de caractères.');
  }

  if (quiz.settings && typeof quiz.settings !== 'object') {
    addError(errors, 'Le bloc settings du quiz doit être un objet.');
  }

  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    addError(errors, 'Le quiz doit contenir au moins une question.');
  }

  if (quiz.questions) {
    quiz.questions.forEach((question, index) => validateQuestion(question, errors, index));
  }

  if (quiz.settings) {
    const { leaderboardSize, maxPlayers, delayBeforeNext } = quiz.settings;
    if (leaderboardSize !== undefined && (!Number.isInteger(leaderboardSize) || leaderboardSize < 3 || leaderboardSize > 10)) {
      addError(errors, 'leaderboardSize doit être un entier entre 3 et 10.');
    }
    if (maxPlayers !== undefined && (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 200)) {
      addError(errors, 'maxPlayers doit être un entier entre 1 et 200.');
    }
    if (delayBeforeNext !== undefined && (!Number.isFinite(Number(delayBeforeNext)) || Number(delayBeforeNext) < 0)) {
      addError(errors, 'delayBeforeNext doit être un nombre positif ou nul.');
    }
  }

  return { valid: errors.length === 0, errors };
}
