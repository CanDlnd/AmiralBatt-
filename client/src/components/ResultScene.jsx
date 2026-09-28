import { Button } from './Button';

const VICTORY_SHIP = '/images/finale/victory-ship.png';
const DEFEAT_SHIP = '/images/finale/defeat-ship.png';

function Coins() {
  return (
    <div className="finale-coins" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <span key={index} style={{ '--i': index }} />
      ))}
    </div>
  );
}

export function ResultScene({ won, lost, error, onRestart, onLeave }) {
  const victory = Boolean(won);

  return (
    <div className={`finale ${victory ? 'finale-win' : 'finale-lose'}`} role="dialog" aria-modal="true">
      <img
        className="finale-ship"
        src={victory ? VICTORY_SHIP : DEFEAT_SHIP}
        alt=""
      />
      <div className="finale-shade" />
      {victory ? <div className="finale-rays" /> : null}
      {victory ? <Coins /> : null}
      <div className="finale-panel">
        <p className="finale-kicker">{victory ? 'ZAFER' : lost ? 'MAĞLUBİYET' : 'SON'}</p>
        <h2>{victory ? 'KAZANDIN' : lost ? 'KAYBETTİN' : 'OYUN BİTTİ'}</h2>
        <p className="finale-line">{victory ? 'Düşman filosu sulara gömüldü.' : 'Filon sulara gömüldü.'}</p>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="finale-actions">
          <Button variant="green" onClick={onRestart}>
            TEKRAR OYNA
          </Button>
          <Button variant="ghost" onClick={onLeave}>
            ANA MENÜ
          </Button>
        </div>
      </div>
    </div>
  );
}
