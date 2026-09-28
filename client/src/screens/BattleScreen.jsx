import { LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Board } from '../components/Board';
import { Captain } from '../components/Captain';
import { ResultScene } from '../components/ResultScene';
import { cellsFor, loadFleet } from '../game/placement';
import { useGame } from '../socket/GameProvider';

export function BattleScreen() {
  const { room, fire, toast, shotFx, error, restart, leave } = useGame();
  const [pending, setPending] = useState(false);
  const yourTurn = room.status === 'battle' && room.currentTurn === room.you.id;
  const ownShips = useMemo(
    () => loadFleet(room.code, room.scenario)
      .filter((ship) => ship.row !== null)
      .map((ship) => ({
        ...ship,
        sunk: cellsFor(ship.row, ship.col, ship.size, ship.orientation).every(
          (cell) => room.you.board?.[cell.row]?.[cell.col] === 'sunk',
        ),
      })),
    [room.code, room.you.board],
  );
  const youSitLeft = Boolean(room.you.isHost);
  const left = youSitLeft ? room.you : room.opponent;
  const right = youSitLeft ? room.opponent : room.you;
  const leftTurn = room.status === 'battle' && room.currentTurn === left?.id;
  const rightTurn = room.status === 'battle' && room.currentTurn === right?.id;
  const [leftShot, setLeftShot] = useState('');
  const [rightShot, setRightShot] = useState('');

  useEffect(() => {
    if (!shotFx?.id) return;
    if (shotFx.shooterId === left?.id) setLeftShot(shotFx.id);
    else if (shotFx.shooterId === right?.id) setRightShot(shotFx.id);
  }, [shotFx, left?.id, right?.id]);
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
    <section className={`battle screen ${youSitLeft ? 'seat-left' : 'seat-right'}`}>
      <header className="scorebar glass">
        <div className={`side ${leftTurn ? 'hot' : ''}`}>
          <strong>{left?.name || 'Rakip'}</strong>
          <span>Kalan Gemi: {left?.shipsRemaining ?? 0}</span>
        </div>
        <div className="vs">VS</div>
        <div className={`side ${rightTurn ? 'hot' : ''}`}>
          <strong>{right?.name || 'Rakip'}</strong>
          <span>Kalan Gemi: {right?.shipsRemaining ?? 0}</span>
        </div>
      </header>

      <div key={room.currentTurn || room.status} className={`turn ${yourTurn ? 'yours' : 'theirs'}`}>
        {room.status === 'finished' ? 'OYUN BİTTİ' : yourTurn ? 'SIRA SENDE' : 'RAKİBİN SIRASI'}
      </div>

      {toast ? <div className={`callout ${toast.kind === 'sunk' ? 'sunk-banner' : ''}`}>{toast.text}</div> : null}
      {room.opponent && !room.opponent.connected && room.status === 'battle' ? (
        <p className="hint bad">Rakip yeniden bağlanıyor...</p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="battle-stage">
        <div className="boards">
        <Captain className="captain-left" shotId={leftShot} />
        <Board
          className="board-you"
          title="SENİN TAHTAN"
          subtitle="Gemilerin"
          grid={room.you.board}
          ships={ownShips}
          active={!yourTurn && room.status === 'battle'}
          fx={shotFx?.board === 'you' ? shotFx : null}
        />
        <Board
          className="board-enemy"
          title="RAKİP TAHTASI"
          subtitle={yourTurn ? 'Ateş etmek için bir kare seç' : 'Rakibin tahtası'}
          grid={room.opponent?.board}
          mode={yourTurn && room.opponent?.connected ? 'fire' : 'view'}
          active={yourTurn}
          fx={shotFx?.board === 'enemy' ? shotFx : null}
          onFire={onFire}
        />
        <Captain className="captain-right" mirrored shotId={rightShot} />
        </div>
      </div>

      <button type="button" className="text-leave" onClick={leave}>
        <LogOut size={16} /> Ayrıl
      </button>

      {room.status === 'finished' ? (
        <ResultScene
          won={won}
          lost={lost}
          error={error}
          onRestart={restart}
          onLeave={leave}
        />
      ) : null}
    </section>
  );
}
