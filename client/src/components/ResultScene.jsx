import { Button } from './Button';

const PAPER = [
  ['#fff', '#f3e2b0'],
  ['#fff7ea', '#e8b15a'],
  ['#ffd4c4', '#d4533c'],
  ['#fff', '#f6d7a2'],
  ['#f7c4ae', '#c2412d'],
  ['#fffdf8', '#ecd4a4'],
];

function piece(i) {
  const strip = i % 4 !== 0;
  const [face, shade] = PAPER[i % PAPER.length];
  const side = i % 2 === 0 ? -1 : 1;
  return {
    id: i,
    w: strip ? 7 + (i % 3) * 2 : 11,
    h: strip ? 14 + (i % 5) * 3 : 9,
    radius: i % 9 === 0 ? '40%' : '1px',
    face,
    shade,
    x: `${(i * 17) % 96}%`,
    dx: `${side * (18 + (i * 13) % 90)}px`,
    drop: `${68 + (i * 11) % 42}vh`,
    spin: `${side * (200 + (i * 19) % 260)}deg`,
    tilt: `${side * (35 + (i * 7) % 45)}deg`,
    delay: `${(i % 14) * 0.16}s`,
    dur: `${6.4 + (i % 7) * 0.42}s`,
  };
}

const BURST = Array.from({ length: 84 }, (_, i) => piece(i));

function Confetti() {
  return (
    <div className="confetti-burst" aria-hidden="true">
      {BURST.map((piece) => (
        <i
          key={piece.id}
          style={{
            '--w': `${piece.w}px`,
            '--h': `${piece.h}px`,
            '--r': piece.radius,
            '--face': piece.face,
            '--shade': piece.shade,
            '--dx': piece.dx,
            '--drop': piece.drop,
            '--x': piece.x,
            '--spin': piece.spin,
            '--tilt': piece.tilt,
            '--d': piece.delay,
            '--dur': piece.dur,
          }}
        />
      ))}
    </div>
  );
}

export function ResultScene({ won, lost, error, youName, opponentName, youScore = 0, opponentScore = 0, youAsked = false, theyAsked = false, onRematch, onLeave }) {
  const victory = Boolean(won);

  return (
    <>
      {victory ? <Confetti /> : null}
      <div className={`verdict ${victory ? 'verdict-win' : 'verdict-lose'}`} role="status">
        <div className="verdict-copy">
          <h2>{victory ? 'KAZANDIN' : lost ? 'KAYBETTİN' : 'OYUN BİTTİ'}</h2>
          <p className="verdict-line">{victory ? 'Düşman filosu sulara gömüldü.' : 'Filon sulara gömüldü.'}</p>
          <p className="verdict-score" aria-label="Oda skoru">
            <span>{youName}</span>
            <strong>{youScore}</strong>
            <span aria-hidden="true">–</span>
            <strong>{opponentScore}</strong>
            <span>{opponentName}</span>
          </p>
          {error ? <p className="form-error">{error}</p> : null}
          {theyAsked && !youAsked ? <p className="verdict-wait">Rakip rövanş istiyor.</p> : null}
          {youAsked && !theyAsked ? <p className="verdict-wait">Rakibin onayı bekleniyor.</p> : null}
        </div>
        <div className="verdict-actions">
          <Button variant="green" disabled={youAsked} onClick={onRematch}>
            {youAsked ? 'ONAY BEKLENİYOR' : 'Rövanş İste'}
          </Button>
          <Button variant="ghost" onClick={onLeave}>
            Ana Menüye Dön
          </Button>
        </div>
      </div>
    </>
  );
}
