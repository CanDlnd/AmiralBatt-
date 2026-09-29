import { GAME_BACKGROUND, MENU_BACKGROUND } from '../game/art';

export function OceanBackground({ scene = 'menu' }) {
  const playing = scene === 'game';
  return (
    <div className={`ocean ocean-${playing ? 'game' : 'menu'}`} aria-hidden="true">
      <img
        key={playing ? 'deck' : 'menu'}
        className="ocean-photo"
        src={playing ? GAME_BACKGROUND : MENU_BACKGROUND}
        alt=""
        draggable={false}
      />
      <div className="ocean-shade" />
    </div>
  );
}
