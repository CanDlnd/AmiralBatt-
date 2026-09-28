import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sounds';
import { emitAck, socket } from './socket';

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
  const skipState = useRef(false);
  const roomRef = useRef(null);
  const busy = useRef(false);
  const seenOver = useRef('');
  const scenarioId = useRef('');
  const coastKey = useRef('');
  roomRef.current = room;

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
      }
    };

    const onShot = (payload) => {
      const youId = roomRef.current?.you?.id;
      const byYou = payload.shooterId === youId;
      setShotFx({
        id: `${Date.now()}-${payload.row}-${payload.col}`,
        board: byYou ? 'enemy' : 'you',
        shooterId: payload.shooterId,
        cells: payload.cells?.length ? payload.cells : [{ row: payload.row, col: payload.col }],
        result: payload.result,
      });
      const keepsTurn = byYou && payload.currentTurn === youId;
      sfx.play('shot');
      if (payload.result === 'miss') {
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
      clearFleetCache();
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
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room_state', onState);
      socket.off('shot_result', onShot);
      socket.off('game_over', onOver);
      socket.off('game_error', onError);
      socket.off('restart_game', onRoundReset);
      socket.off('start_game', onRoundReset);
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
    clearError: () => setError(''),
    createRoom,
    joinRoom,
    setReady: (ready) => request('set_ready', { ready }),
    setScenario: (scenarioId) => request('set_scenario', { scenarioId }),
    startGame: () => request('start_game', {}),
    placeShips: (ships) => request('place_ships', { ships }),
    fire: (row, col) => request('fire', { row, col }),
    restart: () => {
      seenOver.current = '';
      setShotFx(null);
      setToast(null);
      clearFleetCache();
      return request('restart_game', {});
    },
    leave,
    retry,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
