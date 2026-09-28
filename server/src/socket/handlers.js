import { GameError } from '../utils/errors.js';
import { sanitizeCode, sanitizeName, sanitizeToken } from '../utils/sanitize.js';
import {
  createRoom,
  handleDisconnect,
  joinRoom,
  leaveRoom,
  reconnectPlayer,
  restartGame,
  setReady,
  setScenario,
  shoot,
  startGame,
  submitShips,
} from '../rooms/roomManager.js';

function asObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new GameError('Geçersiz istek.');
  }
  return payload;
}

function on(socket, event, handler) {
  socket.on(event, (payload, cb) => {
    let callback = cb;
    let body = payload;
    if (typeof payload === 'function') {
      callback = payload;
      body = {};
    }
    try {
      const result = handler(body ?? {});
      if (typeof callback === 'function') callback({ ok: true, ...(result || {}) });
    } catch (error) {
      const message = error instanceof GameError ? error.message : 'Geçersiz istek.';
      if (!(error instanceof GameError)) console.error(error);
      if (typeof callback === 'function') callback({ ok: false, message });
      else socket.emit('game_error', { message });
    }
  });
}

export function registerHandlers(io, socket) {
  on(socket, 'create_room', (payload) => {
    const body = asObject(payload);
    const name = sanitizeName(body.name);
    if (!name) throw new GameError('Geçerli bir isim gir. En fazla 16 karakter.');
    return createRoom(io, socket, name);
  });

  on(socket, 'join_room', (payload) => {
    const body = asObject(payload);
    const name = sanitizeName(body.name);
    const code = sanitizeCode(body.code);
    if (!name) throw new GameError('Geçerli bir isim gir. En fazla 16 karakter.');
    if (!code) throw new GameError('Oda kodu 6 karakter olmalı.');
    return joinRoom(io, socket, code, name);
  });

  on(socket, 'reconnect_player', (payload) => {
    const body = asObject(payload);
    const code = sanitizeCode(body.code);
    const token = sanitizeToken(body.token);
    if (!code || !token) throw new GameError('Oturum bulunamadı.');
    return reconnectPlayer(io, socket, code, token);
  });

  on(socket, 'set_ready', (payload) => {
    const body = asObject(payload);
    if (typeof body.ready !== 'boolean') throw new GameError('Geçersiz istek.');
    setReady(io, socket, body.ready);
  });

  on(socket, 'set_scenario', (payload) => {
    const body = asObject(payload);
    if (typeof body.scenarioId !== 'string') throw new GameError('Geçersiz istek.');
    setScenario(io, socket, body.scenarioId);
  });

  on(socket, 'start_game', (payload) => {
    asObject(payload);
    startGame(io, socket);
  });

  on(socket, 'place_ships', (payload) => {
    const body = asObject(payload);
    if (!Array.isArray(body.ships)) throw new GameError('Geçersiz gemi yerleşimi.');
    return submitShips(io, socket, body.ships);
  });

  on(socket, 'fire', (payload) => {
    const body = asObject(payload);
    return shoot(io, socket, body.row, body.col);
  });

  on(socket, 'restart_game', (payload) => {
    asObject(payload);
    restartGame(io, socket);
  });

  on(socket, 'leave_room', (payload) => {
    asObject(payload);
    leaveRoom(io, socket);
  });

  socket.on('disconnect', () => {
    handleDisconnect(io, socket);
  });
}
