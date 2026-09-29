import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sounds';
import { emitAck, socket } from './socket';
import { RADIO_LINES } from '../game/radio';

const GameContext = createContext(null);
const TOKEN_KEY = 'ab_token';
const ROOM_KEY = 'ab_room';

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame yalnızca oyun içinde kullanılabilir.');
  return value;
}

function clearFleetCache() {
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('ab_fleet_')) sessionStorage.removeItem(key);
  }
}

export function GameProvider({ children }) {
  const [link, setLink] = useState('connecting');
  const [offline, setOffline] = useState(false);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [shotFx, setShotFx] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [radioMsg, setRadioMsg] = useState(null);
  const [fog, setFog] = useState(null);
  const [veil, setVeil] = useState(() => new Set());
  const [boardSnap, setBoardSnap] = useState(null);
  const [sealedSunk, setSealedSunk] = useState(null);
  const [fogPins, setFogPins] = useState(() => new Set());
  const skipState = useRef(false);
  const roomRef = useRef(null);
  const busy = useRef(false);
  const seenOver = useRef('');
  const scenarioId = useRef('');
  const coastKey = useRef('');
  const radioTimer = useRef(0);
  const revealTimer = useRef(0);
  const revealing = useRef(false);
  const sequenceKeys = useRef(new Set());
  const released = useRef(new Set());
  const snapRef = useRef(null);
  roomRef.current = room;

  function cloneBoard(board) {
    return board?.map((row) => row.slice()) || null;
  }

  function resetWeather() {
    revealing.current = false;
    sequenceKeys.current = new Set();
    released.current = new Set();
    snapRef.current = null;
    clearTimeout(revealTimer.current);
    setFog(null);
    setVeil(new Set());
    setBoardSnap(null);
    setSealedSunk(null);
    setFogPins(new Set());
  }

  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    setError('');
  }, [room?.status]);

  useEffect(() => {
    let offlineTimer = 0;
    let toastTimer = 0;
    let wasOnline = false;

    const flash = (text, kind) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToast({ id, text, kind });
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, 1700);
    };

    const onConnect = () => {
      clearTimeout(offlineTimer);
      wasOnline = true;
      setOffline(false);
      setLink('online');
      if (skipState.current) return;
      const code = sessionStorage.getItem(ROOM_KEY);
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (!code || !token) return;
      socket.timeout(8000).emit('reconnect_player', { code, token }, (err, response) => {
        if (skipState.current) return;
        if (err || !response?.ok) {
          sessionStorage.removeItem(ROOM_KEY);
          sessionStorage.removeItem(TOKEN_KEY);
          setRoom(null);
          if (response?.message) setError(response.message);
        }
      });
    };

    const onDisconnect = () => {
      setLink('offline');
      clearTimeout(offlineTimer);
      offlineTimer = setTimeout(() => setOffline(true), wasOnline ? 1200 : 0);
    };

    const onConnectError = () => {
      setLink('offline');
      if (!wasOnline) setOffline(true);
    };

    const onState = (state) => {
      if (skipState.current || !state?.code || !state.you) return;
      sessionStorage.setItem(ROOM_KEY, state.code);
      const nextCoast = `${state.scenario?.rows || 0}x${state.scenario?.cols || 0}|${(state.scenario?.blocked || []).map((cell) => `${cell[0]}:${cell[1]}`).join('|')}`;
      if (
        scenarioId.current
        && (scenarioId.current !== state.scenario?.id || coastKey.current !== nextCoast)
      ) {
        clearFleetCache();
      }
      scenarioId.current = state.scenario?.id || '';
      coastKey.current = nextCoast;
      setRoom(state);
      if (state.status === 'lobby' || state.status === 'placing') {
        setShotFx(null);
        setToast(null);
        setLastMove(null);
        setRadioMsg(null);
        resetWeather();
      } else if (revealing.current) {
        setVeil((current) => veilChanges(state, current));
      } else if (state.fog?.cells?.length) {
        setFog({
          cells: state.fog.cells.filter((cell) => Number.isInteger(cell?.row) && Number.isInteger(cell?.col)),
          turns: Number.isInteger(state.fog.turns) ? state.fog.turns : 4,
          clearing: false,
        });
      } else {
        setFog(null);
      }
    };

    const veilChanges = (state, current) => {
      const next = new Set(current);
      const sides = [
        ['you', state.you?.board, snapRef.current?.you],
        ['enemy', state.opponent?.board, snapRef.current?.enemy],
      ];
      for (const [side, live, previous] of sides) {
        if (!live || !previous) continue;
        for (let row = 0; row < live.length; row += 1) {
          for (let col = 0; col < (live[row]?.length || 0); col += 1) {
            const key = `${side}:${row}:${col}`;
            if (released.current.has(key)) continue;
            if (sequenceKeys.current.has(key) || live[row][col] !== previous[row]?.[col]) next.add(key);
          }
        }
      }
      return next;
    };

    const finishReveal = () => {
      revealing.current = false;
      sequenceKeys.current = new Set();
      released.current = new Set();
      snapRef.current = null;
      setBoardSnap(null);
      setVeil(new Set());
      setSealedSunk(null);
      setFog(null);
      setFogPins(new Set());
    };

    const releaseAround = (boardName, row, col) => {
      const live = boardName === 'enemy' ? roomRef.current?.opponent?.board : roomRef.current?.you?.board;
      if (live?.[row]?.[col] !== 'sunk') return;
      const stack = [[row, col]];
      const seen = new Set([`${boardName}:${row}:${col}`]);
      while (stack.length) {
        const [currentRow, currentCol] = stack.pop();
        for (let dRow = -1; dRow <= 1; dRow += 1) {
          for (let dCol = -1; dCol <= 1; dCol += 1) {
            const nextRow = currentRow + dRow;
            const nextCol = currentCol + dCol;
            const key = `${boardName}:${nextRow}:${nextCol}`;
            if (seen.has(key) || live?.[nextRow]?.[nextCol] !== 'sunk') continue;
            seen.add(key);
            if (sequenceKeys.current.has(key)) continue;
            released.current.add(key);
            stack.push([nextRow, nextCol]);
          }
        }
      }
    };

    const onShot = (payload) => {
      const youId = roomRef.current?.you?.id;
      const byYou = payload.shooterId === youId;
      if (payload.result === 'fogged') {
        setShotFx({
          id: `${Date.now()}-${payload.row}-${payload.col}`,
          board: byYou ? 'enemy' : 'you',
          shooterId: payload.shooterId,
          cells: [{ row: payload.row, col: payload.col }],
          result: 'fogged',
        });
        setLastMove({
          row: payload.row,
          col: payload.col,
          board: byYou ? 'enemy' : 'you',
        });
        sfx.play('fog');
        if (payload.auto) flash(byYou ? 'Süre doldu. Rastgele atış yapıldı.' : 'Rakibin süresi doldu.');
        else flash(byYou ? 'Sis yuttu.' : 'Atış sisin içinde.');
        const pinKey = `${byYou ? 'enemy' : 'you'}:${payload.row}:${payload.col}`;
        setFogPins((current) => {
          const next = new Set(current);
          next.add(pinKey);
          return next;
        });
        return;
      }
      setShotFx({
        id: `${Date.now()}-${payload.row}-${payload.col}`,
        board: byYou ? 'enemy' : 'you',
        shooterId: payload.shooterId,
        cells: payload.cells?.length ? payload.cells : [{ row: payload.row, col: payload.col }],
        result: payload.result,
        panic: Boolean(payload.panic),
        sunk: payload.result === 'sunk',
        echo: false,
      });
      setLastMove({
        row: payload.row,
        col: payload.col,
        board: byYou ? 'enemy' : 'you',
      });
      const keepsTurn = byYou && payload.currentTurn === youId;
      sfx.play('shot');
      if (payload.auto) {
        if (payload.result === 'miss') sfx.play('miss');
        else if (payload.result === 'sunk') sfx.play('sunk');
        else sfx.play('hit');
        flash(byYou ? 'Süre doldu. Rastgele atış yapıldı.' : 'Rakibin süresi doldu.');
      } else if (payload.result === 'miss') {
        sfx.play('miss');
        flash(byYou ? 'Iska!' : 'Rakip ıskaladı');
      } else if (payload.result === 'sunk') {
        sfx.play('sunk');
        flash(keepsTurn ? 'GEMİ BATTI! Tekrar ateş et.' : 'GEMİ BATTI!', 'sunk');
      } else {
        sfx.play('hit');
        if (byYou) flash(keepsTurn ? 'İsabet! Tekrar ateş et.' : 'İsabet!');
      }
    };

    const onOver = (payload) => {
      const youId = roomRef.current?.you?.id;
      if (!youId || !payload?.winnerId) return;
      const key = `${payload.round || 0}:${payload.winnerId}`;
      if (seenOver.current === key) return;
      seenOver.current = key;
      const won = payload.winnerId === youId;
      setTimeout(() => sfx.play(won ? 'victory' : 'defeat'), 650);
    };

    const onError = (payload) => {
      if (!skipState.current && payload?.message) setError(payload.message);
    };

    const onRoundReset = () => {
      setShotFx(null);
      setToast(null);
      setLastMove(null);
      setRadioMsg(null);
      resetWeather();
      clearFleetCache();
    };

    const onFogStart = (payload) => {
      if (revealing.current || !Array.isArray(payload?.cells)) return;
      const cells = payload.cells
        .filter((cell) => Number.isInteger(cell?.row) && Number.isInteger(cell?.col))
        .map((cell) => ({ row: cell.row, col: cell.col }));
      if (!cells.length) return;
      setFog({
        cells,
        turns: Number.isInteger(payload.turns) ? payload.turns : 4,
        clearing: false,
      });
    };

    const onFogClear = (payload) => {
      if (revealing.current) return;
      const youId = roomRef.current?.you?.id;
      const queue = (Array.isArray(payload?.sequence) ? payload.sequence : [])
        .filter((item) => Number.isInteger(item?.row) && Number.isInteger(item?.col))
        .map((item) => ({
          row: item.row,
          col: item.col,
          result: item.result === 'miss' ? 'miss' : 'hit',
          shooterId: item.shooterId,
          board: item.shooterId === youId ? 'enemy' : 'you',
          panic: Boolean(item.panic),
          sunk: Boolean(item.sunk),
          echo: Boolean(item.echo),
        }));
      const keys = new Set(queue.map((item) => `${item.board}:${item.row}:${item.col}`));
      revealing.current = true;
      sequenceKeys.current = keys;
      released.current = new Set();
      snapRef.current = {
        you: cloneBoard(roomRef.current?.you?.board),
        enemy: cloneBoard(roomRef.current?.opponent?.board),
      };
      setBoardSnap(snapRef.current);
      setVeil(keys);
      setSealedSunk(Array.isArray(payload?.sunkSizes) ? payload.sunkSizes : []);
      setFog((current) => ({
        cells: current?.cells?.length
          ? current.cells
          : queue.map((item) => ({ row: item.row, col: item.col })),
        turns: 0,
        clearing: true,
      }));
      flash('Sis dağılıyor.');
      if (!queue.length) {
        revealTimer.current = setTimeout(finishReveal, 700);
        return;
      }
      let index = 0;
      const step = () => {
        if (index >= queue.length) {
          finishReveal();
          return;
        }
        const item = queue[index];
        index += 1;
        const key = `${item.board}:${item.row}:${item.col}`;
        released.current.add(key);
        releaseAround(item.board, item.row, item.col);
        setFogPins((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        setVeil((current) => {
          const next = new Set(current);
          for (const done of released.current) next.delete(done);
          return next;
        });
        const live = item.board === 'enemy' ? roomRef.current?.opponent?.board : roomRef.current?.you?.board;
        const kind = live?.[item.row]?.[item.col];
        const burst = kind === 'sunk' ? 'sunk' : item.result;
        setShotFx({
          id: `reveal-${index}-${item.row}-${item.col}`,
          board: item.board,
          shooterId: item.shooterId,
          cells: [{ row: item.row, col: item.col }],
          result: burst,
          panic: Boolean(item.panic),
          sunk: Boolean(item.sunk) || burst === 'sunk',
          echo: Boolean(item.echo),
        });
        if (burst === 'miss') sfx.play('miss');
        else if (burst === 'sunk') sfx.play('sunk');
        else sfx.play('hit');
        revealTimer.current = setTimeout(step, 250);
      };
      revealTimer.current = setTimeout(step, 250);
    };

    const onRadio = (payload) => {
      const line = payload && RADIO_LINES[payload.key];
      if (!line || typeof payload.from !== 'string') return;
      const id = `${Date.now()}-${payload.key}`;
      setRadioMsg({ id, from: payload.from, key: payload.key });
      clearTimeout(radioTimer.current);
      radioTimer.current = setTimeout(() => {
        setRadioMsg((current) => (current?.id === id ? null : current));
      }, 2500);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room_state', onState);
    socket.on('shot_result', onShot);
    socket.on('game_over', onOver);
    socket.on('game_error', onError);
    socket.on('restart_game', onRoundReset);
    socket.on('start_game', onRoundReset);
    socket.on('quickChat', onRadio);
    socket.on('weather:fogStart', onFogStart);
    socket.on('weather:fogClear', onFogClear);

    const bootTimer = setTimeout(() => {
      if (!socket.connected) {
        setLink('offline');
        setOffline(true);
      }
    }, 4000);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      clearTimeout(bootTimer);
      clearTimeout(offlineTimer);
      clearTimeout(toastTimer);
      clearTimeout(radioTimer.current);
      clearTimeout(revealTimer.current);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room_state', onState);
      socket.off('shot_result', onShot);
      socket.off('game_over', onOver);
      socket.off('game_error', onError);
      socket.off('restart_game', onRoundReset);
      socket.off('start_game', onRoundReset);
      socket.off('quickChat', onRadio);
      socket.off('weather:fogStart', onFogStart);
      socket.off('weather:fogClear', onFogClear);
    };
  }, []);

  async function request(event, payload) {
    if (busy.current) return { ok: false, silent: true };
    busy.current = true;
    try {
      const response = await emitAck(event, payload);
      if (!response.ok && !response.silent && !skipState.current) {
        setError(response.message || 'İşlem başarısız.');
      } else if (response.ok) {
        setError('');
      }
      return response;
    } finally {
      busy.current = false;
    }
  }

  async function createRoom(name) {
    skipState.current = false;
    setError('');
    const response = await request('create_room', { name });
    if (response.ok) {
      sessionStorage.setItem(TOKEN_KEY, response.token);
      sessionStorage.setItem(ROOM_KEY, response.code);
      localStorage.setItem('ab_name', response.name);
    }
    return response;
  }

  async function joinRoom(name, code) {
    skipState.current = false;
    setError('');
    const response = await request('join_room', { name, code });
    if (response.ok) {
      sessionStorage.setItem(TOKEN_KEY, response.token);
      sessionStorage.setItem(ROOM_KEY, response.code);
      localStorage.setItem('ab_name', response.name);
    }
    return response;
  }

  function leave() {
    skipState.current = true;
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ROOM_KEY);
    clearFleetCache();
    setRoom(null);
    setError('');
    setToast(null);
    setShotFx(null);
    setLastMove(null);
    setRadioMsg(null);
    resetWeather();
    seenOver.current = '';
    socket.emit('leave_room', {}, () => {});
  }

  function retry() {
    setOffline(false);
    setLink('connecting');
    if (!socket.connected) socket.connect();
  }

  const value = {
    link,
    offline,
    room,
    error,
    toast,
    shotFx,
    lastMove,
    radioMsg,
    fog,
    veil,
    boardSnap,
    sealedSunk,
    fogPins,
    clearError: () => setError(''),
    createRoom,
    joinRoom,
    setReady: (ready) => request('set_ready', { ready }),
    setScenario: (scenarioId) => request('set_scenario', { scenarioId }),
    startGame: () => request('start_game', {}),
    placeShips: (ships, decoy) => request('place_ships', { ships, decoy }),
    fire: (row, col) => request('fire', { row, col }),
    rematch: () => request('rematch', {}),
    sendRadio: (key) => emitAck('quickChat:send', { key }),
    leave,
    retry,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
