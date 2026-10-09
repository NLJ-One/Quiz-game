import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import { GameStore } from './game.js';
import { createLoginHandler, createLoginRateLimiter, requireHost, verifyHostToken } from './auth.js';
import { validateQuiz } from '../web/shared/quiz-schema.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..', 'web');

export function createApplication({
  hostPassword = process.env.HOST_PASSWORD || '',
  sessionSecret = process.env.SESSION_SECRET || '',
  clientOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
  serveWeb = process.env.NODE_ENV !== 'production'
} = {}) {
  const app = express();
  const server = http.createServer(app);
  const games = new GameStore();
  const corsOptions = {
    origin(origin, callback) {
      callback(null, !origin || clientOrigins.includes(origin));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type']
  };
  const io = new Server(server, {
    cors: corsOptions,
    perMessageDeflate: { threshold: 1024 }
  });

  app.set('trust proxy', 1);
  app.use(compression());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, games: games.games.size });
  });

  app.post('/api/auth', createLoginRateLimiter(), createLoginHandler({ hostPassword, sessionSecret }));

  app.post('/api/games', requireHost(sessionSecret), (req, res) => {
    const { quiz } = req.body ?? {};
    const result = validateQuiz(quiz);
    if (!result.valid) {
      return res.status(400).json({ error: result.errors });
    }

    let code;
    do {
      code = String(crypto.randomInt(100000, 1000000));
    } while (games.getGame(code));

    games.createGame({ code, quiz, hostSocket: null });
    const hostToken = req.get('authorization').replace(/^Bearer\s+/i, '');
    return res.status(201).json({ code, hostToken });
  });

  if (serveWeb) {
    app.use(express.static(webDir, { etag: true, maxAge: 0 }));
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      socket.data.hostAuthenticated = false;
      return next();
    }

    if (!verifyHostToken(token, sessionSecret)) {
      return next(new Error('Jeton hôte invalide ou expiré.'));
    }

    socket.data.hostAuthenticated = true;
    return next();
  });

  io.on('connection', (socket) => {
    socket.emit('server:ready', { ok: true });
  });

  return { app, server, io, games };
}

export function startServer() {
  if (process.env.NODE_ENV === 'production' && (!process.env.HOST_PASSWORD || !process.env.SESSION_SECRET)) {
    throw new Error('HOST_PASSWORD et SESSION_SECRET doivent être configurés en production.');
  }

  const { server } = createApplication();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => {
    console.log(`Serveur démarré sur http://${host}:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
