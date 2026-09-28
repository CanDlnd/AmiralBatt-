import { GAME_BACKGROUND, MENU_BACKGROUND } from '../game/art';

export function OceanBackground({ scene = 'menu' }) {
  const src = scene === 'game' ? GAME_BACKGROUND : MENU_BACKGROUND;
  return (
    <div className={`ocean ocean-${scene}`} aria-hidden="true">
      <img className="ocean-photo" src={src} alt="" />
      <div className="ocean-shade" />
    </div>
  );
}
