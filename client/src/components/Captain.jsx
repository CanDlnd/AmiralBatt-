import { CAPTAIN_MOODS } from '../game/art';

const MOODS = ['idle', 'sink', 'rage', 'panic', 'defeat', 'win'];

export function CaptainPortrait({ mood = 'idle' }) {
  const active = MOODS.includes(mood) ? mood : 'idle';
  return (
    <div className="captain-portrait" aria-hidden="true">
      {MOODS.map((name) => (
        <img
          key={name}
          className={name === active ? 'is-on' : ''}
          src={CAPTAIN_MOODS[name]}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}
