import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { buildBoards, createGame, fireShot, getShotResult, placeShips, validateShips } from './src/game/engine.js';
import { registerHandlers } from './src/socket/handlers.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fleetA = [
  { size: 4, row: 0, col: 0, orientation: 'h' },
  { size: 3, row: 2, col: 0, orientation: 'h' },
  { size: 3, row: 4, col: 0, orientation: 'h' },
  { size: 2, row: 6, col: 0, orientation: 'h' },
  { size: 2, row: 8, col: 0, orientation: 'h' },
  { size: 1, row: 9, col: 9, orientation: 'h' },
];

const fleetB = [
  { size: 4, row: 0, col: 0, orientation: 'v' },
  { size: 3, row: 0, col: 2, orientation: 'h' },
  { size: 3, row: 2, col: 2, orientation: 'v' },
  { size: 2, row: 2, col: 4, orientation: 'h' },
  { size: 2, row: 5, col: 5, orientation: 'v' },
  { size: 1, row: 9, col: 9, orientation: 'h' },
];

const decoyA = { row: 9, col: 7 };
const decoyB = { row: 9, col: 5 };

const targets = [
  [0, 0], [1, 0], [2, 0], [3, 0],
  [0, 2], [0, 3], [0, 4],
  [2, 2], [3, 2], [4, 2],
  [2, 4], [2, 5],
  [5, 5], [6, 5],
  [9, 9],
];

function unit() {
  assert(!validateShips(fleetA.slice(0, 2)).ok, 'eksik filo');
  assert(validateShips(fleetA).ok, 'filo A');
  assert(validateShips(fleetB).ok, 'filo B');
  const overlap = fleetA.map((ship, index) => (index === 1 ? { ...ship, row: 0, col: 0 } : ship));
  const overlapped = validateShips(overlap);
  assert(!overlapped.ok && overlapped.message === 'Bu konuma gemi yerleştirilemez.', overlapped.message);
  const beside = fleetA.map((ship, index) => (index === 1 ? { ...ship, row: 1, col: 0 } : ship));
  const besideTry = validateShips(beside);
  assert(!besideTry.ok && besideTry.message === 'Bu konuma gemi yerleştirilemez.', besideTry.message);
  const diagonal = fleetA.map((ship, index) => (index === 1 ? { ...ship, row: 1, col: 4 } : ship));
  const diagonalTry = validateShips(diagonal);
  assert(!diagonalTry.ok && diagonalTry.message === 'Bu konuma gemi yerleştirilemez.', diagonalTry.message);
  const game = createGame('a', 'b');
  assert(!placeShips(game, 'a', fleetA).ok, 'şamandırasız yerleşim yok');
  assert(placeShips(game, 'a', fleetA, decoyA).ok, 'A yerleşti');
  assert(!placeShips(createGame('a', 'b'), 'a', fleetA, { row: 0, col: 0 }).ok, 'gemi üstüne şamandıra yok');
  assert(placeShips(game, 'b', fleetB, decoyB).bothReady, 'savaş başladı');
  const view = buildBoards(game, 'a');
  assert(view.enemyBoard.every((row) => row.every((cell) => cell === 'unknown')), 'rakip gizli');
  assert(view.yourBoard[0][0] === 'ship', 'kendi gemisi görünür');
  assert(!fireShot(game, 'b', 0, 0).ok, 'sıra hostta');
  const hit = fireShot(game, 'a', 0, 0);
  assert(hit.ok && hit.result === 'hit', 'ilk isabet');
  assert(game.currentTurn === 'a', 'isabette sıra kalır');
  assert(!fireShot(game, 'a', 0, 0).ok, 'aynı hücre');
  const boards = buildBoards(game, 'a');
  const revealed = boards.enemyBoard.flat().filter((cell) => cell !== 'unknown');
  assert(revealed.length === 1 && revealed[0] === 'hit', 'sadece vurulan hücre');
  const miss = fireShot(game, 'a', 9, 0);
  assert(miss.ok && miss.result === 'miss' && game.currentTurn === 'b', 'ıskada sıra değişir');
  const rock = getShotResult([], [], 2, 0, 'cove');
  assert(!rock.ok && rock.message === 'Buraya ateş edilemez.', rock.message);
  const openFleet = [
    { size: 5, row: 0, col: 0, orientation: 'h' },
    { size: 4, row: 2, col: 0, orientation: 'h' },
    { size: 3, row: 4, col: 0, orientation: 'h' },
    { size: 3, row: 6, col: 0, orientation: 'h' },
    { size: 2, row: 8, col: 0, orientation: 'h' },
    { size: 2, row: 10, col: 0, orientation: 'h' },
  ];
  assert(validateShips(openFleet, 'open').ok, 'açık deniz filosu');
  const coveBad = fleetA.map((ship, index) => (index === 0 ? { ...ship, row: 4, col: 0, orientation: 'h' } : ship));
  const coveTry = validateShips(coveBad, 'cove');
  assert(!coveTry.ok && coveTry.message === 'Bu konuma gemi yerleştirilemez.', coveTry.message);

  const haloGame = createGame('a', 'b');
  assert(placeShips(haloGame, 'a', fleetA, decoyA).ok, 'halo A');
  assert(placeShips(haloGame, 'b', fleetB, decoyB).bothReady, 'halo savaş');
  for (const [row, col] of [[0, 0], [1, 0], [2, 0], [3, 0]]) {
    const shot = fireShot(haloGame, 'a', row, col);
    assert(shot.ok && (shot.result === 'hit' || shot.result === 'sunk'), 'halo kurulum');
  }
  assert(haloGame.currentTurn === 'a', 'batışta sıra kalır');
  const haloView = buildBoards(haloGame, 'a');
  assert(haloView.enemyBoard[0][0] === 'sunk', 'gemi battı');
  assert(haloView.enemyBoard[0][1] === 'miss', 'yan komşu ıska');
  assert(haloView.enemyBoard[1][1] === 'miss', 'çapraz komşu ıska');
  assert(haloView.enemyBoard[0][2] === 'unknown', 'bitişik gemi boş kalır');
  assert(!fireShot(haloGame, 'a', 0, 1).ok, 'halo hücresine ateş yok');
  const ownHalo = buildBoards(haloGame, 'b');
  assert(ownHalo.yourBoard[0][1] === 'miss', 'kendi tahtasında da ıska');

  const bluff = createGame('a', 'b');
  assert(placeShips(bluff, 'a', fleetA, decoyA).ok, 'blöf A');
  assert(placeShips(bluff, 'b', fleetB, { row: 8, col: 8 }).bothReady, 'blöf savaş');
  const sinkBeside = fireShot(bluff, 'a', 9, 9);
  assert(sinkBeside.ok && sinkBeside.result === 'sunk', 'yan gemi battı');
  const besideView = buildBoards(bluff, 'a');
  assert(besideView.enemyBoard[8][8] === 'unknown', 'şamandıra çevrelenmez');
  assert(besideView.enemySunk.length === 1, 'sadece gerçek batış');
  const fake = fireShot(bluff, 'a', 8, 8);
  assert(fake.ok && fake.result === 'hit', 'şamandıra isabet');
  assert(bluff.currentTurn === 'a', 'şamandırada sıra kalır');
  assert(bluff.decoys.b.triggered, 'şamandıra tetiklendi');
  const bluffView = buildBoards(bluff, 'a');
  assert(bluffView.enemyBoard[8][8] === 'hit', 'rakip standart isabet görür');
  assert(bluffView.enemyBoard[8][7] === 'unknown' && bluffView.enemyBoard[7][8] === 'unknown', 'komşular açık');
  assert(bluffView.enemySunk.length === 1, 'şamandıra filo şeridine girmez');
  assert(bluffView.enemyDecoy === null, 'maçta şamandıra gizli');
  assert(bluffView.enemyRemaining === 5, 'şamandıra can eksiltmez');
  const owner = buildBoards(bluff, 'b');
  assert(owner.yourBoard[8][8] === 'decoy-hit', 'kırık şamandıra');
  assert(owner.yourDecoy?.triggered === true, 'kendi şamandırası');
  assert(!fireShot(bluff, 'a', 8, 8).ok, 'şamandıra tekrar ateş yok');
}

function track(socket) {
  const states = [];
  socket.on('room_state', (state) => states.push(state));
  return {
    latest: () => states.at(-1),
    waitFor(predicate) {
      return new Promise((resolve, reject) => {
        const tick = () => {
          const found = [...states].reverse().find(predicate);
          if (found) {
            cleanup();
            resolve(found);
          }
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('state timeout'));
        }, 4000);
        const onState = () => tick();
        function cleanup() {
          clearTimeout(timer);
          socket.off('room_state', onState);
        }
        socket.on('room_state', onState);
        tick();
      });
    },
  };
}

function emit(socket, event, payload = {}) {
  return new Promise((resolve) => {
    socket.timeout(4000).emit(event, payload, (err, response) => {
      resolve(err ? { ok: false, message: 'timeout' } : response);
    });
  });
}

function connect(port) {
  return new Promise((resolve, reject) => {
    const socket = Client(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function assertSafe(state, token) {
  assert(!JSON.stringify(state).includes(token), 'token sızdı');
  const walk = (value, key) => {
    assert(!['ships', 'orientation', 'token', 'battle'].includes(key), `gizli alan: ${key}`);
    if (Array.isArray(value)) value.forEach((item) => walk(item, ''));
    else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) walk(child, childKey);
    }
  };
  walk(state, '');
  if (state.opponent?.board) {
    for (const row of state.opponent.board) {
      for (const cell of row) {
        assert(['unknown', 'miss', 'hit', 'sunk', 'fogged'].includes(cell), `rakip hücre: ${cell}`);
      }
    }
  }
}

async function main() {
  unit();
  const port = 3099;
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: true } });
  io.on('connection', (socket) => registerHandlers(io, socket));
  await new Promise((resolve) => httpServer.listen(port, resolve));

  const p1 = await connect(port);
  const p2 = await connect(port);
  const t1 = track(p1);
  const t2 = track(p2);

  const badName = await emit(p1, 'create_room', { name: '<<<>>>' });
  assert(!badName.ok, 'boş isim');

  const created = await emit(p1, 'create_room', { name: '  Can<script>  ' });
  assert(created.ok, created.message || 'oda kurulamadı');
  assert(!created.name.includes('<'), 'isim temizlenmedi');
  const lobby = await t1.waitFor((state) => state.status === 'lobby');
  assert(lobby.code.length === 6, 'kod 6 karakter');
  assertSafe(lobby, created.token);

  const missing = await emit(p2, 'join_room', { name: 'Ali', code: 'ZZZZZZ' });
  assert(!missing.ok, 'olmayan oda');

  const joined = await emit(p2, 'join_room', { name: 'Ali', code: created.code.toLowerCase() });
  assert(joined.ok, joined.message || 'katılım');
  const paired = await t1.waitFor((state) => state.opponent?.name === 'Ali');
  assert(paired.you.isHost, 'kurucu');
  assertSafe(paired, created.token);
  assertSafe(t2.latest(), joined.token);

  const early = await emit(p1, 'start_game', {});
  assert(!early.ok, 'hazır olmadan başlangıç');
  assert(!(await emit(p2, 'start_game', {})).ok, 'misafir başlatamaz');

  assert((await emit(p1, 'set_ready', { ready: true })).ok, 'p1 hazır');
  assert((await emit(p2, 'set_ready', { ready: true })).ok, 'p2 hazır');
  assert((await emit(p1, 'start_game', {})).ok, 'başlat');
  await t1.waitFor((state) => state.status === 'placing');
  await t2.waitFor((state) => state.status === 'placing');

  const badFleet = await emit(p1, 'place_ships', { ships: fleetA.map((ship, index) => (index === 5 ? { ...ship, row: 0, col: 0 } : ship)), decoy: decoyA });
  assert(!badFleet.ok, 'çakışan filo');

  assert((await emit(p1, 'place_ships', { ships: fleetA, decoy: decoyA })).ok, 'p1 filo');
  const hidden = await t2.waitFor((state) => state.opponent?.shipsConfirmed);
  assert(hidden.opponent.board.every((row) => row.every((cell) => cell === 'unknown')), 'onaydan sonra da gizli');
  assert((await emit(p2, 'place_ships', { ships: fleetB, decoy: decoyB })).ok, 'p2 filo');
  const battle = await t1.waitFor((state) => state.status === 'battle');
  assert(battle.currentTurn === battle.you.id, 'ilk sıra kurucuda');
  assertSafe(battle, created.token);

  assert(!(await emit(p2, 'fire', { row: 0, col: 0 })).ok, 'yanlış sıra');
  assert(!(await emit(p1, 'fire', { row: 20, col: 0 })).ok, 'kötü koordinat');

  for (let index = 0; index < targets.length; index += 1) {
    const [row, col] = targets[index];
    if (index === 1) {
      const duplicate = await emit(p1, 'fire', { row: targets[0][0], col: targets[0][1] });
      assert(!duplicate.ok, 'ikinci atış aynı hücre');
    }
    const shot = await emit(p1, 'fire', { row, col });
    assert(shot.ok, shot.message || `atış ${index}`);
    if (index === 0) {
      assert(!(await emit(p2, 'fire', { row: 1, col: 0 })).ok, 'isabet sonrası sıra değişmez');
    }
    if (index < targets.length - 1) {
      assert(shot.currentTurn === created.playerId, 'isabet sonrası sıra sende');
    }
    const seen = await t1.waitFor((state) => state.opponent.board[row][col] === 'hit' || state.opponent.board[row][col] === 'sunk' || state.status === 'finished');
    assertSafe(seen, created.token);
  }

  const finished = await t1.waitFor((state) => state.status === 'finished');
  assert(finished.winnerId === finished.you.id, 'kurucu kazandı');
  assert(finished.you.score === 1, 'kazanan skoru');
  const loser = await t2.waitFor((state) => state.status === 'finished');
  assert(loser.winnerId !== loser.you.id, 'ikinci oyuncu kaybetti');
  assert(loser.you.shipsRemaining === 0, 'filo bitti');
  assert(loser.you.score === 0 && loser.opponent.score === 1, 'kaybeden skoru');
  assertSafe(loser, joined.token);

  const asked = await emit(p1, 'rematch', {});
  assert(asked.ok && asked.waiting, 'tek rövanş beklemede');
  const waiting = await t1.waitFor((state) => state.status === 'finished' && state.you.rematch);
  assert(!waiting.opponent.rematch, 'tek taraflı maç başlamaz');

  const agreed = await emit(p2, 'rematch', {});
  assert(agreed.ok && !agreed.waiting, 'rövanş başladı');
  const placing = await t1.waitFor((state) => state.status === 'placing' && state.you.score === 1 && !state.you.shipsConfirmed);
  assert(placing.you.score === 1, 'skor rövanşta durur');
  assert(t1.latest().code === created.code && t2.latest()?.code === created.code, 'oda aynı');

  assert((await emit(p1, 'place_ships', { ships: fleetA, decoy: decoyA })).ok, 'rövanş p1 filo');
  assert((await emit(p2, 'place_ships', { ships: fleetB, decoy: decoyB })).ok, 'rövanş p2 filo');
  const battle2 = await t2.waitFor((state) => state.status === 'battle' && state.currentTurn === state.you.id);
  assert(battle2.currentTurn === battle2.you.id, 'ikinci maçta sıra misafirde');
  const hostBattle = await t1.waitFor((state) => state.status === 'battle' && state.currentTurn === state.opponent?.id);
  assert(hostBattle.currentTurn === hostBattle.opponent.id, 'kurucu ikinci maçta bekler');

  const heard = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2000);
    p1.once('quickChat', (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
  const chat = await emit(p2, 'quickChat:send', { key: 'nice' });
  assert(chat.ok, chat.message || 'telsiz');
  const incoming = await heard;
  assert(incoming?.key === 'nice' && incoming.from === joined.playerId, 'telsiz balonu');
  assert(!('text' in (incoming || {})), 'telsiz metni sızmadı');
  const spam = await emit(p2, 'quickChat:send', { key: 'miss' });
  assert(!spam.ok, 'telsiz spam');
  let leaked = false;
  const onLeak = () => {
    leaked = true;
  };
  p2.on('quickChat', onLeak);
  const junk = await emit(p1, 'quickChat:send', { key: 'merhaba' });
  p2.off('quickChat', onLeak);
  assert(!junk.ok, 'telsiz anahtar');
  assert(!leaked, 'bozuk telsiz gitmedi');

  const p3 = await connect(port);
  const full = await emit(p3, 'join_room', { name: 'Veli', code: created.code });
  assert(!full.ok, 'oda dolu');

  assert((await emit(p2, 'leave_room', {})).ok !== false, 'ayrıl');
  await t1.waitFor((state) => state.status === 'abandoned');
  assert(t1.latest().you.score === 1, 'ayrılınca skor durur');

  p1.disconnect();
  p2.disconnect();
  p3.disconnect();
  io.close();
  await new Promise((resolve) => httpServer.close(resolve));
  console.log('smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
