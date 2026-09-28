export const HIT_MARK = '/images/hit.png';
export const HIT_FRAMES = [1, 2, 3, 4, 5].map((frame) => `/images/hit/hit-0${frame}.png`);
export const MISS_MARK = '/images/miss.png';
export const MISS_FRAMES = [1, 2, 3, 4, 5].map((frame) => `/images/miss/miss-0${frame}.png`);
export const OCEAN_TILE = '/images/grid/ocean-tile.png';
export const MENU_BACKGROUND = '/images/menu-background.png';
export const GAME_BACKGROUND = '/images/game-background.png';
export const LOGO = '/images/logo.png';
export const CAPTAIN_IDLE = '/images/captan-man/captan-man-fire-animate1.png';
export const CAPTAIN_FIRE = '/images/captan-man/captan-man-fire-animate2.png';

const FRAMES = {
  1: { w: 1536, h: 1024, aw: 1368 / 1536, ah: 554 / 1024 },
  2: { w: 1672, h: 941, aw: 1484 / 1672, ah: 480 / 941 },
  3: { w: 1536, h: 1024, aw: 1496 / 1536, ah: 458 / 1024 },
  4: { w: 1774, h: 887, aw: 1723 / 1774, ah: 400 / 887 },
};

export function shipSrc(size) {
  const art = size === 5 ? 4 : size;
  return `/images/ships/ship-${art}.png`;
}

export function shipArtStyle(size) {
  const frame = FRAMES[size] || FRAMES[size === 5 ? 4 : 1];
  return {
    '--aw': frame.aw,
    '--ah': frame.ah,
    '--iw': frame.w,
    '--ih': frame.h,
  };
}
