import 'dotenv/config';
import { io } from 'socket.io-client';

function readOptions(args) {
  const options = { players: 100, duration: 60 };
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (key === '--help') {
      console.log('Usage: npm run loadtest -- --url <server-url> [--players 100] [--duration 60]');
      process.exit(0);
    }
    if (!['--url', '--players', '--duration'].includes(key) || !value) {
      throw new Error(`Argument invalide : ${key}`);
    }
    if (key === '--url') options.url = value;
    if (key === '--players') options.players = Number(value);
    if (key === '--duration') options.duration = Number(value);
    index += 1;
  }

  if (!options.url) throw new Error('Fournis l’URL du serveur avec --url.');
  if (!Number.isInteger(options.players) || options.players < 1 || options.players > 150) {
    throw new Error('--players doit être un entier entre 1 et 150.');
  }
  if (!Number.isInteger(options.duration) || options.duration < 1 || options.duration > 600) {
    throw new Error('--duration doit être un entier entre 1 et 600 secondes.');
  }
  if (!process.env.HOST_PASSWORD) throw new Error('La variable HOST_PASSWORD doit être définie.');

  const url = new URL(options.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('L’URL doit utiliser HTTP ou HTTPS.');
  options.url = url.origin;
  return options;
}

async function postJson(url, payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.join?.(' ') || result.error || `Erreur HTTP ${response.status}`);
  return result;
}

function connectBot(url) {
  const socket = io(url, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket', 'polling'],
    timeout: 30000
  });
  const connected = new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  socket.connect();
  return { socket, connected };
}

async function run() {
  const options = readOptions(process.argv.slice(2));
  const health = await fetch(`${options.url}/health`);
  if (!health.ok) throw new Error(`Health check refusé : HTTP ${health.status}`);

  const { token } = await postJson(`${options.url}/api/auth`, { password: process.env.HOST_PASSWORD });
  await postJson(`${options.url}/api/games`, {
    quiz: {
      id: `load-test-${Date.now()}`,
      title: 'Test de charge WeddingQuiz',
      questions: [{
        id: 'load-test-question',
        type: 'single',
        text: 'Question de test',
        duration: 30,
        choices: ['A', 'B'],
        correctAnswer: 'A'
      }]
    }
  }, token);

  const bots = Array.from({ length: options.players }, () => connectBot(options.url));
  try {
    const results = await Promise.allSettled(bots.map((bot) => bot.connected));
    const connected = results.filter((result) => result.status === 'fulfilled').length;
    console.log(`${connected}/${options.players} client(s) Socket.IO connecté(s).`);
    if (connected !== options.players) {
      const failure = results.find((result) => result.status === 'rejected');
      throw new Error(`Échec de connexion d’un ou plusieurs clients : ${failure.reason.message}`);
    }

    console.log(`Maintien des connexions pendant ${options.duration} s…`);
    await new Promise((resolve) => setTimeout(resolve, options.duration * 1000));
  } finally {
    for (const bot of bots) bot.socket.disconnect();
  }
}

run().catch((error) => {
  console.error(`Test de charge échoué : ${error.message}`);
  process.exitCode = 1;
});
