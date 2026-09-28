import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerHandlers } from './socket/handlers.js';

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.disable('x-powered-by');

app.get('/health', (_req, res) => {
  res.json({ ok: true, game: 'amiral-batti' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  connectionStateRecovery: {
    maxDisconnectionDuration: 20000,
    skipMiddlewares: true,
  },
});

io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`Amiral Battı sunucusu http://localhost:${PORT}`);
});
