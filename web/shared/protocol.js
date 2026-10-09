export const SOCKET_EVENTS = {
  HOST_CREATE: 'host:create',
  HOST_START: 'host:start',
  HOST_NEXT: 'host:next',
  HOST_SKIP: 'host:skip',
  HOST_PAUSE: 'host:pause',
  HOST_RESUME: 'host:resume',
  HOST_KICK: 'host:kick',
  HOST_END: 'host:end',
  HOST_RECONNECT: 'host:reconnect',

  PLAYER_JOIN: 'player:join',
  PLAYER_ANSWER: 'player:answer',
  PLAYER_RECONNECT: 'player:reconnect',

  LOBBY_UPDATE: 'lobby:update',
  GAME_STARTING: 'game:starting',
  QUESTION_SHOW: 'question:show',
  QUESTION_END: 'question:end',
  LEADERBOARD_SHOW: 'leaderboard:show',
  GAME_FINISHED: 'game:finished',
  GAME_ERROR: 'game:error'
};

/**
 * Host -> server payloads.
 *
 * host:create: { code: string, quizId: string, hostPassword?: string }
 * host:start: { gameId: string }
 * host:next: { gameId: string }
 * host:skip: { gameId: string }
 * host:pause: { gameId: string }
 * host:resume: { gameId: string }
 * host:kick: { gameId: string, playerId: string }
 * host:end: { gameId: string }
 * host:reconnect: { code: string, hostPassword?: string }
 *
 * Player -> server payloads.
 *
 * player:join: { code: string, pseudo: string, table?: string }
 * player:answer: { gameId: string, questionId: string, answer: unknown, clientTimestamp: number }
 * player:reconnect: { gameId: string, token: string }
 *
 * Server -> clients payloads.
 *
 * lobby:update: { code: string, players: Array<{ id: string, pseudo: string, table?: string, score: number }>, host: boolean }
 * game:starting: { gameId: string, startsAt: number }
 * question:show: { questionId: string, endsAt: number, serverNow: number, duration: number, prompt: string, choices?: Array<string>, media?: string, type: string }
 * question:end: { questionId: string, correctAnswer?: unknown, leaderboard?: Array<object>, stats?: object }
 * leaderboard:show: { standings: Array<object> }
 * game:finished: { standings: Array<object>, winner?: object }
 * game:error: { message: string }
 */
export const SOCKET_PAYLOADS = {};
