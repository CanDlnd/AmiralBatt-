import { LogOut } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../components/Board';
import { CaptainPortrait } from '../components/Captain';
import { fleetStatus } from '../components/FleetStrip';
import { RadioDock } from '../components/RadioDock';
import { ResultScene } from '../components/ResultScene';
import { RADIO_LINES } from '../game/radio';
import { cellsFor, loadFleet } from '../game/placement';
import { useGame } from '../socket/GameProvider';

function buoyMarker(decoy, id, reveal = false) {
  if (!decoy || !Number.isInteger(decoy.row) || !Number.isInteger(decoy.col)) return [];
  return [{
    id,
    size: 1,
    row: decoy.row,
    col: decoy.col,
    orientation: 'h',
    buoy: true,
    reveal,
    broken: Boolean(decoy.triggered),
  }];
}

function maskedBoard(live, previous, veil, side) {
  if (!live || !previous || !veil?.size) return live;
  return live.map((row, rowIndex) => row.map((cell, colIndex) => (
    veil.has(`${side}:${rowIndex}:${colIndex}`) ? (previous[rowIndex]?.[colIndex] ?? cell) : cell
  )));
}

function omitSizes(sizes, hidden) {
  const left = [...(hidden || [])];
  return (sizes || []).filter((size) => {
    const index = left.indexOf(size);
    if (index < 0) return true;
    left.splice(index, 1);
    return false;
  });
}

export function BattleScreen() {
  const { room, fire, toast, shotFx, lastMove, radioMsg, error, rematch, sendRadio, leave, fog, veil, fogPins, boardSnap, sealedSunk } = useGame();
  const [pending, setPending] = useState(false);
  const yourTurn = room.status === 'battle' && room.currentTurn === room.you.id;
  const ownShips = useMemo(
    () => loadFleet(room.code, room.scenario)
      .filter((ship) => ship.row !== null)
      .map((ship) => ({
        ...ship,
        sunk: cellsFor(ship.row, ship.col, ship.size, ship.orientation).every(
          (cell) => room.you.board?.[cell.row]?.[cell.col] === 'sunk',
        ) && !cellsFor(ship.row, ship.col, ship.size, ship.orientation).some(
          (cell) => veil.has(`you:${cell.row}:${cell.col}`),
        ),
      })),
    [room.code, room.you.board, veil],
  );
  const youSitLeft = Boolean(room.you.isHost);
  const left = youSitLeft ? room.you : room.opponent;
  const right = youSitLeft ? room.opponent : room.you;
  const leftTurn = room.status === 'battle' && room.currentTurn === left?.id;
  const rightTurn = room.status === 'battle' && room.currentTurn === right?.id;
  const [faces, setFaces] = useState({});
  const streaks = useRef({});
  const faceTimers = useRef({});
  const moods = useRef({});
  const seenMood = useRef('');

  useEffect(() => () => {
    Object.values(faceTimers.current).forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!shotFx?.id || !shotFx.shooterId || seenMood.current === shotFx.id) return;
    if (shotFx.result === 'fogged' || shotFx.echo) {
      seenMood.current = shotFx.id;
      return;
    }
    seenMood.current = shotFx.id;
    const shooterId = shotFx.shooterId;
    const defenderId = shooterId === room.you.id ? room.opponent?.id : room.you.id;
    const sunk = shotFx.result === 'sunk' || Boolean(shotFx.sunk);
    const hold = (playerId, mood) => {
      if (!playerId) return;
      moods.current[playerId] = mood;
      setFaces((current) => ({ ...current, [playerId]: mood }));
      clearTimeout(faceTimers.current[playerId]);
      if (mood === 'idle') return;
      faceTimers.current[playerId] = setTimeout(() => {
        if (moods.current[playerId] !== mood) return;
        moods.current[playerId] = 'idle';
        setFaces((current) => ({ ...current, [playerId]: 'idle' }));
      }, 3000);
    };

    if (shotFx.result === 'miss') {
      const next = (streaks.current[shooterId] || 0) + 1;
      streaks.current[shooterId] = next;
      if (next >= 2) hold(shooterId, 'rage');
      return;
    }

    streaks.current[shooterId] = 0;
    if (sunk) hold(shooterId, 'sink');
    else if (moods.current[shooterId] === 'rage') hold(shooterId, 'idle');
    if (shotFx.panic) hold(defenderId, 'panic');
  }, [shotFx, room.you.id, room.opponent?.id]);

  function portraitMood(playerId) {
    if (!playerId) return 'idle';
    if (room.status === 'finished' && room.winnerId) {
      return room.winnerId === playerId ? 'win' : 'defeat';
    }
    return faces[playerId] || 'idle';
  }
  const yourFleet = fleetStatus(
    room.scenario?.fleet,
    omitSizes(room.you.sunkSizes, sealedSunk?.find((item) => item.playerId === room.you.id)?.sizes),
  );
  const enemyFleet = fleetStatus(
    room.scenario?.fleet,
    omitSizes(room.opponent?.sunkSizes, sealedSunk?.find((item) => item.playerId === room.opponent?.id)?.sizes),
  );
  const yourGrid = maskedBoard(room.you.board, boardSnap?.you, veil, 'you');
  const enemyGrid = maskedBoard(room.opponent?.board, boardSnap?.enemy, veil, 'enemy');
  const enemyShips = useMemo(() => {
    if (room.status !== 'finished' || veil.size || fog?.clearing || !Array.isArray(room.opponent?.revealed)) return null;
    return room.opponent.revealed
      .filter((ship) => Number.isInteger(ship?.row) && Number.isInteger(ship?.col) && Number.isInteger(ship?.size))
      .map((ship) => ({
        id: ship.id || `${ship.row}-${ship.col}-${ship.size}`,
        size: ship.size,
        row: ship.row,
        col: ship.col,
        orientation: ship.facing === 'v' ? 'v' : 'h',
        sunk: Boolean(ship.sunk),
      }));
  }, [room.status, room.opponent?.revealed, veil, fog]);
  const leftLine = useRef(null);
  const rightLine = useRef(null);
  const clockKey = room.turnClock ? `${room.turnClock.deadline}:${room.currentTurn || ''}` : '';
  useEffect(() => {
    const clock = room.turnClock;
    const live = room.status === 'battle' && clock && room.currentTurn;
    let frame = 0;
    const paint = (scaleLeft, scaleRight) => {
      if (leftLine.current) leftLine.current.style.transform = `scaleX(${scaleLeft})`;
      if (rightLine.current) rightLine.current.style.transform = `scaleX(${scaleRight})`;
    };
    if (!live) {
      paint(1, 1);
      return undefined;
    }
    const skew = clock.now - Date.now();
    const tick = () => {
      const remain = clock.deadline - (Date.now() + skew);
      const scale = Math.max(0, Math.min(1, remain / (clock.ms || 20000)));
      paint(room.currentTurn === left?.id ? scale : 1, room.currentTurn === right?.id ? scale : 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clockKey, room.status, room.currentTurn, left?.id, right?.id, room.turnClock]);
  const radioLine = radioMsg ? RADIO_LINES[radioMsg.key] : null;
  const radioFromLeft = radioMsg?.from === left?.id;
  const won = room.status === 'finished' && room.winnerId === room.you.id;
  const lost = room.status === 'finished' && room.winnerId && room.winnerId !== room.you.id;

  async function onFire(row, col) {
    if (!yourTurn || pending || !room.opponent?.connected) return;
    if (room.opponent.board?.[row]?.[col] !== 'unknown') return;
    setPending(true);
    await fire(row, col);
    setPending(false);
  }

  return (
    <section className={`battle screen ${youSitLeft ? 'seat-left' : 'seat-right'}${room.status === 'finished' ? ' is-finished' : ''}${won ? ' is-won' : ''}${lost ? ' is-lost' : ''}`}>
      <header className={`scorebar${leftTurn ? ' hot-left' : ''}${rightTurn ? ' hot-right' : ''}`} aria-label={`Oda skoru ${left?.score ?? 0} ${right?.score ?? 0}`}>
        <span className={`turn-clip turn-clip-left ${youSitLeft ? 'is-you' : 'is-foe'}${leftTurn ? ' is-live' : ''}`} aria-hidden="true">
          <span ref={leftLine} className="turn-line" />
        </span>
        <span className={`turn-clip turn-clip-right ${youSitLeft ? 'is-foe' : 'is-you'}${rightTurn ? ' is-live' : ''}`} aria-hidden="true">
          <span ref={rightLine} className="turn-line" />
        </span>
        <div className={`side side-left ${youSitLeft ? 'is-you' : 'is-foe'} ${leftTurn ? 'hot' : ''}`}>
          <div className="side-face">
            {radioLine && radioFromLeft ? (
              <p key={radioMsg.id} className="radio-callout from-left" role="status">
                <span className="sr-only">Rakip telsizi. </span>
                <span className="radio-mark" aria-hidden="true">{radioLine.mark}</span>
                {radioLine.text}
              </p>
            ) : null}
            <CaptainPortrait mood={portraitMood(left?.id)} />
          </div>
          <div className="side-copy">
            <em className="side-role">{youSitLeft ? 'SEN' : 'RAKİP'}</em>
            <strong>{left?.name || 'Rakip'}</strong>
            <span>{left?.score ?? 0}</span>
          </div>
        </div>
        <div className="vs">
          <span className="vs-mark">VS</span>
        </div>
        <div className={`side side-right ${youSitLeft ? 'is-foe' : 'is-you'} ${rightTurn ? 'hot' : ''}`}>
          <div className="side-copy">
            <em className="side-role">{youSitLeft ? 'RAKİP' : 'SEN'}</em>
            <strong>{right?.name || 'Rakip'}</strong>
            <span>{right?.score ?? 0}</span>
          </div>
          <div className="side-face">
            <CaptainPortrait mood={portraitMood(right?.id)} />
            {radioLine && !radioFromLeft ? (
              <p key={radioMsg.id} className="radio-callout from-right" role="status">
                <span className="sr-only">Rakip telsizi. </span>
                <span className="radio-mark" aria-hidden="true">{radioLine.mark}</span>
                {radioLine.text}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {room.status === 'finished' ? (
        <ResultScene
          won={won}
          lost={lost}
          error={error}
          youName={room.you.name}
          opponentName={room.opponent?.name || 'Rakip'}
          youScore={room.you.score || 0}
          opponentScore={room.opponent?.score || 0}
          youAsked={room.you.rematch}
          theyAsked={room.opponent?.rematch}
          onRematch={rematch}
          onLeave={leave}
        />
      ) : (
        <div key={room.currentTurn || room.status} className={`turn ${yourTurn ? 'yours' : 'theirs'}`}>
          {yourTurn ? 'SIRA SENDE' : 'RAKİBİN SIRASI'}
        </div>
      )}

      {toast ? <div className={`callout ${toast.kind === 'sunk' ? 'sunk-banner' : ''}`}>{toast.text}</div> : null}
      {room.opponent && !room.opponent.connected && room.status === 'battle' ? (
        <p className="hint bad">Rakip yeniden bağlanıyor...</p>
      ) : null}
      {error && room.status !== 'finished' ? <p className="form-error">{error}</p> : null}

      {room.status === 'battle' ? <RadioDock onSend={sendRadio} /> : null}

      <div className="battle-stage">
        <div className="boards">
        <Board
          className="board-you"
          title="SENİN TAHTAN"
          subtitle="Gemilerin"
          grid={yourGrid}
          ships={[...ownShips, ...buoyMarker(room.you.decoy, 'own-buoy')]}
          fleet={yourFleet}
          fog={fog}
          veil={veil}
          fogPins={fogPins}
          side="you"
          active={!yourTurn && room.status === 'battle'}
          fx={shotFx?.board === 'you' ? shotFx : null}
          lastMove={lastMove?.board === 'you' ? lastMove : null}
        />
        <Board
          className="board-enemy"
          title="RAKİP TAHTASI"
          subtitle={room.status === 'finished' ? 'Rakibin filosu' : yourTurn ? 'Ateş etmek için bir kare seç' : 'Rakibin tahtası'}
          grid={enemyGrid}
          ships={enemyShips ? [...enemyShips, ...buoyMarker(room.opponent?.decoy, 'enemy-buoy', true)] : null}
          fleet={enemyFleet}
          fog={fog}
          veil={veil}
          fogPins={fogPins}
          side="enemy"
          mode={yourTurn && room.opponent?.connected ? 'fire' : 'view'}
          active={yourTurn}
          fx={shotFx?.board === 'enemy' ? shotFx : null}
          lastMove={lastMove?.board === 'enemy' ? lastMove : null}
          axisHover
          onFire={onFire}
        />
        </div>
      </div>

      {room.status !== 'finished' ? (
        <button type="button" className="text-leave" onClick={leave}>
          <LogOut size={16} /> Ayrıl
        </button>
      ) : null}
    </section>
  );
}
