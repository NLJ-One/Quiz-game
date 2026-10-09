import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', 1);
app.use(compression());

const publicDir = path.join(rootDir, 'public');
const sharedDir = path.join(rootDir, 'shared');

app.use('/vendor', express.static(path.join(publicDir, 'vendor'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));
app.use('/assets', express.static(path.join(publicDir, 'assets'), {
  maxAge: '1y',
  immutable: true
}));
app.use('/css', express.static(path.join(publicDir, 'css'), {
  maxAge: '1y',
  immutable: true
}));
app.use('/js', express.static(path.join(publicDir, 'js'), {
  maxAge: '1y',
  immutable: true
}));
app.use('/shared', express.static(sharedDir, {
  maxAge: '1y',
  immutable: true
}));
app.use(express.static(publicDir, {
  index: false,
  maxAge: '1y'
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.get('*', (req, res, next) => {
  const pathname = req.path;
  if (pathname.includes('.') || pathname.startsWith('/api')) {
    return next();
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(publicDir, 'index.html'));
});

io.on('connection', (socket) => {
  socket.emit('server:ready', { ok: true });
});

server.listen(PORT, HOST, () => {
  console.log(`Serveur démarré sur http://${HOST}:${PORT}`);
});
