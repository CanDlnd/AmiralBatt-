import { randomBytes, randomInt } from 'crypto';
import {
  BATTLE_GRACE_MS,
  CODE_ALPHABET,
  CODE_LENGTH,
  LOBBY_GRACE_MS,
} from '../game/constants.js';
import { getScenario, listScenarios, pickCoveLayout, publicScenario } from '../game/scenarios.js';
import {
  buildBoards,
  createGame,
  emptyBoard,
  fireShot,
  placeShips,
} from '../game/engine.js';
import { GameError } from '../utils/errors.js';

const rooms = new Map();
const socketBindings = new Map();
const tokenIndex = new Map();
const dropTimers = new Map();

function makeCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function uniqueCode() {
  for (let i = 0; i < 30; i += 1) {
    const code = makeCode();
    if (!rooms.has(code)) return code;
  }
  throw new GameError('Oda oluşturulamadı. Tekrar dene.');
}

function makeToken() {
  return randomBytes(16).toString('hex');
}

function makePublicId() {
  return randomBytes(4).toString('hex');
}

function clearDrop(token) {
  const timer = dropTimers.get(token);
  if (timer) clearTimeout(timer);
  dropTimers.delete(token);
}

function otherPlayer(room, token) {
  for (const player of room.players.values()) {
    if (player.token !== token) return player;
  }
  return null;
}

function publicIdOf(room, token) {
  if (!token) return null;
  return room.players.get(token)?.publicId ?? null;
}

export function publicView(room, token) {
  const player = room.players.get(token);
  const opponent = otherPlayer(room, token);
  const scenario = getScenario(room.scenarioId);
  const boards = room.battle
    ? buildBoards(room.battle, token)
    : {
        yourBoard: emptyBoard('empty', scenario.id),
        enemyBoard: opponent ? emptyBoard('unknown', scenario.id) : null,
        yourRemaining: scenario.fleet.length,
        enemyRemaining: opponent ? scenario.fleet.length : 0,
      };

  const pack = (person, board, remaining) => {
    if (!person) return null;
    return {
      id: person.publicId,
      name: person.name,
      ready: person.ready,
      shipsConfirmed: Boolean(room.battle?.confirmed?.[person.token]),
      connected: person.connected,
      isHost: person.token === room.hostId,
      shipsRemaining: remaining,
      board,
    };
  };

  return {
    code: room.code,
    status: room.status,
    scenario: publicScenario(room.scenarioId, room.layout),
    scenarios: listScenarios(),
    hostId: publicIdOf(room, room.hostId),
    currentTurn: room.battle ? publicIdOf(room, room.battle.currentTurn) : null,
    winnerId: room.battle ? publicIdOf(room, room.battle.winnerId) : null,
    abandonedBy: publicIdOf(room, room.abandonedBy),
    you: pack(player, boards.yourBoard, boards.yourRemaining),
    opponent: opponent ? pack(opponent, boards.enemyBoard, boards.enemyRemaining) : null,
  };
}

export function emitRoom(io, room) {
  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    const sock = io.sockets.sockets.get(player.socketId);
    sock?.emit('room_state', publicView(room, player.token));
  }
}

function bindSocket(socket, room, player) {
  socket.join(room.code);
  player.socketId = socket.id;
  player.connected = true;
  socketBindings.set(socket.id, { code: room.code, token: player.token });
  tokenIndex.set(player.token, room.code);
  clearDrop(player.token);
}

function unbindSocket(socket) {
  const binding = socketBindings.get(socket.id);
  socketBindings.delete(socket.id);
  if (binding) socket.leave(binding.code);
  return binding || null;
}

export function detachSocket(io, socket) {
  const binding = socketBindings.get(socket.id);
  if (!binding) return null;
  const room = rooms.get(binding.code);
  const player = room?.players.get(binding.token);
  if (!room || !player || player.socketId !== socket.id) {
    socketBindings.delete(socket.id);
    return null;
  }
  player.connected = false;
  player.socketId = null;
  unbindSocket(socket);
  return { room, player };
}

function createPlayer(socket, name) {
  return {
    token: makeToken(),
    publicId: makePublicId(),
    socketId: socket.id,
    name,
    ready: false,
    connected: true,
  };
}

export function leaveCurrent(io, socket) {
  const binding = socketBindings.get(socket.id);
  if (!binding) return;
  const room = rooms.get(binding.code);
  const player = room?.players.get(binding.token);
  if (!room || !player || player.socketId !== socket.id) {
    socketBindings.delete(socket.id);
    return;
  }
  leaveRoom(io, socket);
}

export function createRoom(io, socket, name) {
  leaveCurrent(io, socket);
  if (rooms.size > 500) throw new GameError('Sunucu dolu. Biraz sonra tekrar dene.');

  const code = uniqueCode();
  const player = createPlayer(socket, name);
  const room = {
    code,
    hostId: player.token,
    status: 'lobby',
    scenarioId: 'classic',
    layout: null,
    players: new Map([[player.token, player]]),
    battle: null,
    abandonedBy: null,
  };
  rooms.set(code, room);
  bindSocket(socket, room, player);
  emitRoom(io, room);
  return { code, token: player.token, playerId: player.publicId, name };
}

export function joinRoom(io, socket, code, name) {
  leaveCurrent(io, socket);
  const room = rooms.get(code);
  if (!room) throw new GameError('Oda bulunamadı.');
  if (room.status !== 'lobby') throw new GameError('Oyun başlamış. Bu odaya katılamazsın.');
  if (room.players.size >= 2) throw new GameError('Oda dolu.');

  const player = createPlayer(socket, name);
  room.players.set(player.token, player);
  bindSocket(socket, room, player);
  io.to(room.code).emit('player_joined', { playerId: player.publicId, name: player.name });
  emitRoom(io, room);
  return { code, token: player.token, playerId: player.publicId, name };
}

export function reconnectPlayer(io, socket, code, token) {
  const room = rooms.get(code);
  const player = room?.players.get(token);
  if (!room || !player || tokenIndex.get(token) !== code) {
    throw new GameError('Oturum bulunamadı.');
  }

  const previousId = player.socketId;
  if (previousId && previousId !== socket.id) {
    const previous = io.sockets.sockets.get(previousId);
    if (previous) {
      socketBindings.delete(previous.id);
      previous.leave(room.code);
      previous.disconnect(true);
    }
  }

  bindSocket(socket, room, player);
  emitRoom(io, room);
  return { code, token, playerId: player.publicId, name: player.name };
}

export function requirePlayer(socket) {
  const binding = socketBindings.get(socket.id);
  if (!binding) throw new GameError('Bu işlem için odada olmalısın.');
  const room = rooms.get(binding.code);
  const player = room?.players.get(binding.token);
  if (!room || !player || player.socketId !== socket.id) {
    throw new GameError('Bu işlem için odada olmalısın.');
  }
  return { room, player };
}

export function setReady(io, socket, ready) {
  const { room, player } = requirePlayer(socket);
  if (room.status !== 'lobby') throw new GameError('Hazır durumu sadece lobide değişir.');
  if (typeof ready !== 'boolean') throw new GameError('Geçersiz istek.');
  player.ready = ready;
  emitRoom(io, room);
}

export function setScenario(io, socket, scenarioId) {
  const { room, player } = requirePlayer(socket);
  if (room.status !== 'lobby') throw new GameError('Harita sadece lobide seçilir.');
  if (player.token !== room.hostId) throw new GameError('Haritayı sadece kurucu seçer.');
  const scenario = getScenario(scenarioId);
  if (scenario.id !== scenarioId) throw new GameError('Böyle bir harita yok.');
  if (room.scenarioId === scenario.id) return;
  room.scenarioId = scenario.id;
  room.layout = scenario.id === 'cove' ? pickCoveLayout(null) : null;
  for (const item of room.players.values()) item.ready = false;
  emitRoom(io, room);
}

export function startGame(io, socket) {
  const { room, player } = requirePlayer(socket);
  if (player.token !== room.hostId) throw new GameError('Sadece oda sahibi oyunu başlatabilir.');
  if (room.status !== 'lobby') throw new GameError('Oyun başlatılamaz.');
  if (room.players.size < 2) throw new GameError('İkinci oyuncu bekleniyor.');

  const players = [...room.players.values()];
  if (players.some((item) => !item.connected)) throw new GameError('Rakip bağlı değil.');
  if (players.some((item) => !item.ready)) throw new GameError('Her iki oyuncu da hazır olmalı.');

  const guest = players.find((item) => item.token !== room.hostId);
  room.round = (room.round || 0) + 1;
  if (room.scenarioId === 'cove') room.layout = pickCoveLayout(room.layout);
  room.battle = createGame(room.hostId, guest.token, room.scenarioId, room.layout);
  room.status = 'placing';
  room.abandonedBy = null;
  io.to(room.code).emit('start_game', { code: room.code });
  emitRoom(io, room);
}

export function submitShips(io, socket, ships) {
  const { room, player } = requirePlayer(socket);
  if (room.status !== 'placing' || !room.battle) {
    throw new GameError('Gemi yerleştirme kapalı.');
  }

  const result = placeShips(room.battle, player.token, ships);
  if (!result.ok) throw new GameError(result.message);

  io.to(room.code).emit('ships_confirmed', { playerId: player.publicId });

  if (room.battle.phase === 'battle') {
    room.status = 'battle';
  }
  emitRoom(io, room);
  return { bothReady: result.bothReady };
}

export function shoot(io, socket, row, col) {
  const { room, player } = requirePlayer(socket);
  if (room.status !== 'battle' || !room.battle) throw new GameError('Şu an ateş edilemez.');

  const opponent = otherPlayer(room, player.token);
  if (!opponent?.connected) throw new GameError('Rakip bağlı değil.');

  const turnBefore = room.battle.currentTurn;
  const result = fireShot(room.battle, player.token, row, col);
  if (!result.ok) throw new GameError(result.message);

  if (room.battle.phase === 'finished') room.status = 'finished';

  const payload = {
    shooterId: player.publicId,
    row: result.row,
    col: result.col,
    result: result.result,
    cells: result.cells,
    currentTurn: publicIdOf(room, result.currentTurn),
    winnerId: publicIdOf(room, result.winnerId),
  };

  io.to(room.code).emit('shot_result', payload);
  if (!result.gameOver && result.currentTurn !== turnBefore) {
    io.to(room.code).emit('turn_changed', { currentTurn: payload.currentTurn });
  } else if (result.gameOver) {
    io.to(room.code).emit('game_over', { winnerId: payload.winnerId, round: room.round || 1 });
  }
  emitRoom(io, room);
  return payload;
}

export function restartGame(io, socket) {
  const { room, player } = requirePlayer(socket);
  if (room.status !== 'finished') throw new GameError('Oyun bitmeden yeniden başlanamaz.');
  if ([...room.players.values()].some((item) => !item.connected)) {
    throw new GameError('Rakip bağlı değil.');
  }

  room.status = 'lobby';
  room.battle = null;
  room.abandonedBy = null;
  for (const item of room.players.values()) item.ready = false;
  io.to(room.code).emit('restart_game', { by: player.publicId });
  emitRoom(io, room);
}

export function leaveRoom(io, socket) {
  const { room, player } = requirePlayer(socket);
  clearDrop(player.token);
  player.connected = false;
  player.socketId = null;
  unbindSocket(socket);

  if (room.status === 'lobby') {
    room.players.delete(player.token);
    tokenIndex.delete(player.token);
    if (room.players.size === 0) {
      rooms.delete(room.code);
      return;
    }
    if (room.hostId === player.token) {
      room.hostId = room.players.keys().next().value;
    }
    io.to(room.code).emit('player_left', { playerId: player.publicId });
    emitRoom(io, room);
    return;
  }

  if (room.status === 'placing' || room.status === 'battle') {
    abandon(io, room, player.token);
    return;
  }

  emitRoom(io, room);
}

function abandon(io, room, token) {
  if (room.status === 'abandoned') return;
  room.status = 'abandoned';
  room.abandonedBy = token;
  const player = room.players.get(token);
  io.to(room.code).emit('player_disconnected', {
    playerId: player?.publicId ?? null,
    message: 'Rakip oyundan ayrıldı.',
  });
  emitRoom(io, room);
}

export function handleDisconnect(io, socket) {
  const detached = detachSocket(io, socket);
  if (!detached) return;
  const { room, player } = detached;

  if (!rooms.has(room.code)) return;
  emitRoom(io, room);

  const wait = room.status === 'lobby' ? LOBBY_GRACE_MS : BATTLE_GRACE_MS;
  clearDrop(player.token);
  const timer = setTimeout(() => {
    dropTimers.delete(player.token);
    const current = rooms.get(room.code);
    const still = current?.players.get(player.token);
    if (!current || !still || still.connected) return;

    if (current.status === 'lobby') {
      current.players.delete(player.token);
      tokenIndex.delete(player.token);
      if (current.players.size === 0) {
        rooms.delete(current.code);
        return;
      }
      if (current.hostId === player.token) {
        current.hostId = current.players.keys().next().value;
      }
      io.to(current.code).emit('player_left', { playerId: player.publicId });
      emitRoom(io, current);
      return;
    }

    if (current.status === 'placing' || current.status === 'battle') {
      abandon(io, current, player.token);
    }
  }, wait);
  dropTimers.set(player.token, timer);
}

export function roomCount() {
  return rooms.size;
}
