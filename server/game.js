import { validateQuiz } from '../web/shared/quiz-schema.js';

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

  start() {
    const result = validateQuiz(this.quiz);
    if (!result.valid) {
      throw new Error(result.errors[0] || 'Le quiz est invalide.');
    }

    this.status = 'active';
    this.currentQuestionIndex = 0;
    this.currentQuestion = this.quiz.questions[0];
    this.answers.clear();
    this.currentEndsAt = Date.now() + (this.currentQuestion.duration || 30) * 1000;

    return {
      question: this.currentQuestion,
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
      question: this.currentQuestion,
      endsAt: this.currentEndsAt,
      serverNow: Date.now()
    };
  }

  recordAnswer(socketId, questionId, answer) {
    if (!this.currentQuestion || this.currentQuestion.id !== questionId) {
      return false;
    }

    const player = this.players.get(socketId);
    if (!player) return false;

    if (!this.answers.has(socketId)) {
      this.answers.set(socketId, { answer, submittedAt: Date.now() });
      return true;
    }

    return false;
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
