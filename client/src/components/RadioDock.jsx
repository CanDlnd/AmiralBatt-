import { Radio } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RADIO_LINES, RADIO_ORDER } from '../game/radio';

export function RadioDock({ onSend }) {
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!root.current?.contains(event.target)) setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  async function choose(key) {
    if (cooling) return;
    setCooling(true);
    setOpen(false);
    const response = await onSend(key);
    if (!response?.ok) {
      setCooling(false);
      return;
    }
    window.setTimeout(() => setCooling(false), 3000);
  }

  return (
    <div className={`radio-dock${open ? ' is-open' : ''}${cooling ? ' is-cooling' : ''}`} ref={root}>
      {open ? (
        <div className="radio-menu" role="group" aria-label="Telsiz">
          {RADIO_ORDER.map((key) => {
            const line = RADIO_LINES[key];
            return (
              <button key={key} type="button" disabled={cooling} onClick={() => choose(key)}>
                <span aria-hidden="true">{line.mark}</span>
                {line.text}
              </button>
            );
          })}
        </div>
      ) : null}
      <button
        type="button"
        className="radio-toggle"
        aria-expanded={open}
        aria-label={cooling ? 'Telsiz birazdan açılır' : 'Telsiz'}
        onClick={() => setOpen((value) => !value)}
      >
        <Radio size={16} strokeWidth={2.4} />
        <span>{cooling ? '...' : 'Telsiz'}</span>
      </button>
    </div>
  );
}
