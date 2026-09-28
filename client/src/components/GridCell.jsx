import { useState } from 'react';
import { MISS_FRAMES, HIT_FRAMES } from '../game/art';
import { MissEffect, missFrameReady } from './effects/MissEffect';
import { HitEffect, hitFrameReady } from './effects/HitEffect';
import { COLS } from '../game/constants';

const VISUAL = {
  unknown: 'empty',
  water: 'empty',
  empty: 'empty',
  ship: 'ship',
  hit: 'hit',
  miss: 'miss',
  sunk: 'sunk',
  rock: 'rock',
  ok: 'empty',
  bad: 'empty',
};

function effectSrc(visual, missFrames, hitFrames) {
  if (visual === 'miss') return missFrameReady(missFrames, 4) ? missFrames[4] : null;
  if (visual === 'hit' || visual === 'sunk') return hitFrameReady(hitFrames, 4) ? hitFrames[4] : null;
  return null;
}

function waterLight(row, col, rows = 10, cols = 10) {
  const dx = (col - (cols - 1) / 2) / ((cols - 1) / 2 || 1);
  const dy = (row - (rows - 1) / 2) / ((rows - 1) / 2 || 1);
  const depth = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
  return (1.16 - depth * 0.46).toFixed(2);
}

export function GridCell({
  cell, row, col, rows = 10, cols = 10, mode, bursting, burstKey, burstResult, missFrames = MISS_FRAMES, hitFrames = HIT_FRAMES, onCellPointerDown, onCellContextMenu,
}) {
  const [missDoneId, setMissDoneId] = useState('');
  const [hitDoneId, setHitDoneId] = useState('');
  const visual = VISUAL[cell.kind] || 'empty';
  const clickable = cell.kind !== 'rock' && (mode === 'place' || (mode === 'fire' && cell.kind === 'unknown'));
  const playMiss = Boolean(
    bursting && burstResult === 'miss' && visual === 'miss' && burstKey && missDoneId !== burstKey,
  );
  const playHit = Boolean(
    bursting
    && (burstResult === 'hit' || burstResult === 'sunk')
    && (visual === 'hit' || visual === 'sunk')
    && burstKey
    && hitDoneId !== burstKey,
  );
  const src = effectSrc(visual, missFrames, hitFrames);

  return (
    <button
      type="button"
      data-row={row}
      data-col={col}
      className={`cell state-${visual}${visual === 'rock' ? ` rock-${(row * 2 + col) % 3}` : ''} ${cell.kind}${cell.selected ? ' selected' : ''}`}
      style={{ '--light': waterLight(row, col, rows, cols) }}
      disabled={!clickable}
      aria-label={`${COLS[col]}${row + 1}`}
      onClick={() => {
        if (mode !== 'fire' || !clickable) return;
        onCellPointerDown?.(null, row, col);
      }}
      onPointerDown={(event) => {
        if (mode !== 'place' || !clickable) return;
        onCellPointerDown?.(event, row, col);
      }}
      onContextMenu={(event) => {
        if (mode !== 'place') return;
        event.preventDefault();
        onCellContextMenu?.(row, col);
      }}
    >
      {src && !playMiss && !playHit ? (
        <img className={`mark mark-${visual}`} src={src} alt="" draggable={false} />
      ) : null}
      {playMiss ? (
        <MissEffect
          playId={burstKey}
          frames={missFrames}
          onComplete={() => setMissDoneId(burstKey)}
        />
      ) : null}
      {playHit ? (
        <HitEffect
          playId={burstKey}
          frames={hitFrames}
          onComplete={() => setHitDoneId(burstKey)}
        />
      ) : null}
    </button>
  );
}
