import { validateQuiz } from '../web/shared/quiz-schema.js';
import { computeScore } from '../web/shared/scoring.js';

export class Game {
  constructor({ code, quiz, hostSocket }) {
    this.code = code;
    this.quiz = quiz;
    this.hostSocket = hostSocket;
    this.players = new Map();
    this.currentQuestionIndex = -1;
    this.status = 'lobby';
    this.currentQuestion = null;
    this.currentEndsAt = 0;
    this.answers = new Map();
  }

  addPlayer(socket, player) {
    const { pseudo, table } = player;
    if (!pseudo || typeof pseudo !== 'string') {
      throw new Error('Le pseudo est invalide.');
    }

    const existing = [...this.players.values()].find((item) => item.pseudo.toLowerCase() === pseudo.toLowerCase());
    if (existing && this.quiz.settings?.uniqueNicknames !== false) {
      throw new Error('Ce pseudo est déjà pris.');
    }

    const normalized = {
      id: socket.id,
      pseudo,
      table: table || 'Table 1',
      score: 0,
      streak: 0,
      socket
    };

    this.players.set(socket.id, normalized);
    return normalized;
  }

  getPublicPlayers() {
    return [...this.players.values()].map(({ id, pseudo, table, score }) => ({ id, pseudo, table, score }));
  }

  getQuestionPayload() {
    if (!this.currentQuestion) return null;
    return {
      id: this.currentQuestion.id,
      text: this.currentQuestion.text,
      type: this.currentQuestion.type,
      duration: this.currentQuestion.duration || 30,
      media: this.currentQuestion.media || '',
      choices: Array.isArray(this.currentQuestion.choices) ? [...this.currentQuestion.choices] : [],
      order: Array.isArray(this.currentQuestion.order) ? [...this.currentQuestion.order] : [],
      endsAt: this.currentEndsAt,
      serverNow: Date.now()
    };
  }

  start() {
    const result = validateQuiz(this.quiz);
    if (!result.valid) {
      throw new Error(result.errors[0] || 'Le quiz est invalide.');
    }

    if (!this.quiz.questions?.length) {
      throw new Error('Le quiz ne contient aucune question.');
    }

    this.status = 'active';
    this.currentQuestionIndex = 0;
    this.currentQuestion = this.quiz.questions[0];
    this.answers.clear();
    this.currentEndsAt = Date.now() + (this.currentQuestion.duration || 30) * 1000;

    return {
      question: this.getQuestionPayload(),
      endsAt: this.currentEndsAt,
      serverNow: Date.now()
    };
  }

  nextQuestion() {
    if (!this.quiz.questions || this.quiz.questions.length === 0) {
      this.status = 'finished';
      return null;
    }

    const nextIndex = this.currentQuestionIndex + 1;
    if (nextIndex >= this.quiz.questions.length) {
      this.status = 'finished';
      return null;
    }

    this.currentQuestionIndex = nextIndex;
    this.currentQuestion = this.quiz.questions[nextIndex];
    this.answers.clear();
    this.currentEndsAt = Date.now() + (this.currentQuestion.duration || 30) * 1000;

    return {
      question: this.getQuestionPayload(),
      endsAt: this.currentEndsAt,
      serverNow: Date.now()
    };
  }

  recordAnswer(socketId, questionId, answer) {
    if (!this.currentQuestion || this.currentQuestion.id !== questionId) {
      return { accepted: false, reason: 'question-mismatch' };
    }

    const player = this.players.get(socketId);
    if (!player) {
      return { accepted: false, reason: 'player-missing' };
    }

    if (this.answers.has(socketId)) {
      return { accepted: false, reason: 'duplicate-answer' };
    }

    const now = Date.now();
    const timeLeftMs = Math.max(0, this.currentEndsAt - now);
    const timeLeftRatio = this.currentQuestion.duration
      ? Math.max(0, Math.min(1, timeLeftMs / (this.currentQuestion.duration * 1000)))
      : 1;

    const score = computeScore(this.currentQuestion, answer, timeLeftRatio, this.quiz.settings || {}, player.streak || 0);
    const isCorrect = score > 0;

    player.score += score;
    player.streak = isCorrect ? (player.streak || 0) + 1 : 0;

    this.answers.set(socketId, {
      answer,
      submittedAt: now,
      score,
      correct: isCorrect
    });

    return {
      accepted: true,
      score,
      correct: isCorrect,
      leaderboard: this.getLeaderboard()
    };
  }

  getLeaderboard() {
    return [...this.players.values()]
      .sort((a, b) => b.score - a.score)
      .map(({ id, pseudo, score, table }) => ({ id, pseudo, score, table }));
  }
}

export class GameStore {
  constructor() {
    this.games = new Map();
  }

  createGame({ code, quiz, hostSocket }) {
    const game = new Game({ code, quiz, hostSocket });
    this.games.set(code, game);
    return game;
  }

  getGame(code) {
    return this.games.get(code);
  }

  deleteGame(code) {
    this.games.delete(code);
  }
}
