import { io } from 'socket.io-client';

export const socket = io({
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 600,
  reconnectionDelayMax: 4000,
  timeout: 8000,
});

export function emitAck(event, payload = {}) {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, message: 'Bağlantı kesildi.' });
      return;
    }
    socket.timeout(8000).emit(event, payload, (err, response) => {
      if (err) resolve({ ok: false, message: 'Sunucu yanıt vermedi.' });
      else resolve(response || { ok: false, message: 'Geçersiz istek.' });
    });
  });
}
