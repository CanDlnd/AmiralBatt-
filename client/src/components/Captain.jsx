import { useEffect, useState } from 'react';
import { CAPTAIN_FIRE, CAPTAIN_IDLE } from '../game/art';

export function Captain({ mirrored = false, shotId = '', className = '' }) {
  const [blast, setBlast] = useState(false);

  useEffect(() => {
    if (!shotId) return undefined;
    setBlast(true);
    const timer = setTimeout(() => setBlast(false), 720);
    return () => clearTimeout(timer);
  }, [shotId]);

  return (
    <div className={`captain ${mirrored ? 'mirror' : ''} ${blast ? 'firing' : ''} ${className}`.trim()} aria-hidden="true">
      <img className="captain-idle" src={CAPTAIN_IDLE} alt="" draggable={false} />
      <img className="captain-fire" src={CAPTAIN_FIRE} alt="" draggable={false} />
    </div>
  );
}
