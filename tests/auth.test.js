import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHostToken,
  createLoginRateLimiter,
  verifyHostToken
} from '../server/auth.js';
import { createApplication } from '../server/server.js';

const SECRET = 'test-session-secret';

test('jeton hôte signé valide, mais rejeté après expiration ou falsification', () => {
  const now = Date.now();
  const token = createHostToken(SECRET, now);
  assert.equal(verifyHostToken(token, SECRET, now), true);
  assert.equal(verifyHostToken(token, SECRET, now + 13 * 60 * 60 * 1000), false);
  assert.equal(verifyHostToken(`${token}x`, SECRET, now), false);
  assert.equal(verifyHostToken(token, 'different-secret', now), false);
});

test('limite les tentatives de connexion à cinq par minute et par IP', () => {
  const limiter = createLoginRateLimiter();
  let responseStatus;
  const req = { ip: '192.0.2.1', socket: {} };
  const res = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json() {
      return this;
    }
  };
  let nextCount = 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    limiter(req, res, () => { nextCount += 1; });
  }
  limiter(req, res, () => { nextCount += 1; });

  assert.equal(nextCount, 5);
  assert.equal(responseStatus, 429);
});

test('authentifie un host et refuse la création de partie avec un quiz invalide', async (t) => {
  const { server, io, games } = createApplication({
    hostPassword: 'correct horse battery',
    sessionSecret: SECRET,
    clientOrigins: ['https://quiz.example'],
    serveWeb: true
  });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => io.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const homePage = await fetch(baseUrl);
  assert.equal(homePage.status, 200);
  assert.match(await homePage.text(), /Quiz de mariage/);

  const badLogin = await fetch(`${baseUrl}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong' })
  });
  assert.equal(badLogin.status, 401);

  const login = await fetch(`${baseUrl}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'correct horse battery' })
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();

  const invalidGame = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ quiz: { id: 'bad', title: '', questions: [] } })
  });
  assert.equal(invalidGame.status, 400);
  assert.equal(games.games.size, 0);

  const validGame = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      quiz: {
        id: 'test-quiz',
        title: 'Quiz test',
        questions: [{
          id: 'question-1',
          type: 'single',
          text: 'Question ?',
          duration: 20,
          choices: ['Oui', 'Non'],
          correctAnswer: 'Oui'
        }]
      }
    })
  });
  assert.equal(validGame.status, 201);
  const created = await validGame.json();
  assert.match(created.code, /^\d{6}$/);
  assert.equal(created.hostToken, token);
  assert.equal(games.games.size, 1);

  const noAuth = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz: {} })
  });
  assert.equal(noAuth.status, 401);
});
