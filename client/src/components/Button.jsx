import { Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { sfx } from '../audio/sounds';

export function Button({
  children,
  icon: Icon,
  variant = 'primary',
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}) {
  return (
    <button
      type={type}
      className={`btn ${variant} ${className}`.trim()}
      disabled={disabled}
      onClick={(event) => {
        if (disabled) return;
        sfx.play('click');
        onClick?.(event);
      }}
    >
      {Icon ? <Icon size={20} strokeWidth={2.5} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function MuteButton() {
  const [muted, setMuted] = useState(sfx.muted);
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      className="mute"
      aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
      onClick={() => {
        const next = sfx.toggle();
        setMuted(next);
        if (!next) sfx.play('click');
      }}
    >
      <Icon size={20} />
    </button>
  );
}
