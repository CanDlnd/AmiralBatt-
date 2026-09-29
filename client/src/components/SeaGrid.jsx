import { forwardRef, Fragment } from 'react';
import { shipArtStyle, shipSrc, BUOY_FLEET } from '../game/art';
import { COLS } from '../game/constants';
import { GridCell } from './GridCell';
import { useMissFrames } from './effects/MissEffect';
import { useHitFrames } from './effects/HitEffect';

function FogLayer({ patches }) {
  if (!patches?.length) return null;
  return (
    <div className="fog-layer" aria-hidden="true">
      {patches.map((patch) => (
        <span
          key={`${patch.row}-${patch.col}`}
          className={`fog-patch${patch.leaving ? ' is-out' : ''}${patch.pin ? ' has-pin' : ''}`}
          style={{ '--row': patch.row, '--col': patch.col, '--fog-delay': `${(patch.row + patch.col) * 0.28}s` }}
        >
          {patch.splash ? <i key={patch.splashId} className="fog-splash" /> : null}
          {patch.pin ? <i className="fog-pin">?</i> : null}
        </span>
      ))}
    </div>
  );
}

function ShipLayer({ ships }) {
  if (!ships?.length) return null;
  return (
    <div className="ship-layer">
      {ships.map((ship) => (
        <span
          key={ship.id}
          className={`ship-sprite ${ship.orientation}${ship.selected ? ' selected' : ''}${ship.sunk ? ' sunk' : ''}${ship.ghost ? ` ghost ${ship.ghost}` : ''}${ship.buoy ? ' buoy' : ''}${ship.reveal ? ' reveal' : ''}${ship.broken ? ' broken' : ''}`}
          style={{ '--row': ship.row, '--col': ship.col, '--size': ship.size }}
          title={ship.buoy ? 'Blöf Noktası' : undefined}
        >
          <img src={ship.buoy ? BUOY_FLEET : shipSrc(ship.size)} alt="" draggable={false} style={ship.buoy ? undefined : shipArtStyle(ship.size)} />
        </span>
      ))}
    </div>
  );
}

export const SeaGrid = forwardRef(function SeaGrid(
  { cells, ships = null, patches = null, mode = 'view', fx = null, lastMove = null, axisHover = false, onCellPointerDown, onCellContextMenu },
  ref,
) {
  const missFrames = useMissFrames();
  const hitFrames = useHitFrames();
  const live = mode === 'fire' || mode === 'place';
  const colCount = cells[0]?.length || COLS.length;
  const rowCount = cells.length || 10;
  const wide = colCount > 10;
  const vast = colCount >= 12;
  const labels = Array.from({ length: colCount }, (_, index) => COLS[index] || `${index + 1}`);

  return (
    <div
      className={`sea${wide ? ' wide' : ''}${vast ? ' vast' : ''} ${live ? 'is-live' : ''} mode-${mode}${axisHover ? ' axis-live' : ''}${ships?.length ? ' has-ships' : ''}`}
      style={{ '--cols': colCount, '--rows': rowCount }}
      ref={ref}
    >
      <div className="sea-label" />
      {labels.map((col, index) => (
        <div key={col} className="sea-label" data-col={index}>
          {col}
        </div>
      ))}
      {cells.map((row, rowIndex) => (
        <Fragment key={rowIndex}>
          <div className="sea-label" data-row={rowIndex}>{rowIndex + 1}</div>
          {row.map((cell, colIndex) => (
            <GridCell
              key={`${rowIndex}-${colIndex}`}
              cell={cell}
              row={rowIndex}
              col={colIndex}
              mode={mode}
              bursting={fx?.cells?.some((item) => item.row === rowIndex && item.col === colIndex)}
              burstKey={fx?.id}
              burstResult={fx?.result}
              marked={lastMove?.row === rowIndex && lastMove?.col === colIndex}
              missFrames={missFrames}
              hitFrames={hitFrames}
              rows={rowCount}
              cols={colCount}
              onCellPointerDown={onCellPointerDown}
              onCellContextMenu={onCellContextMenu}
            />
          ))}
        </Fragment>
      ))}
      <ShipLayer ships={ships} />
      <FogLayer patches={patches} />
    </div>
  );
});
