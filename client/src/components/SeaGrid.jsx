import { forwardRef, Fragment } from 'react';
import { shipArtStyle, shipSrc } from '../game/art';
import { COLS } from '../game/constants';
import { GridCell } from './GridCell';
import { useMissFrames } from './effects/MissEffect';
import { useHitFrames } from './effects/HitEffect';

function ShipLayer({ ships }) {
  if (!ships?.length) return null;
  return (
    <div className="ship-layer">
      {ships.map((ship) => (
        <span
          key={ship.id}
          className={`ship-sprite ${ship.orientation}${ship.selected ? ' selected' : ''}${ship.sunk ? ' sunk' : ''}${ship.ghost ? ` ghost ${ship.ghost}` : ''}`}
          style={{ '--row': ship.row, '--col': ship.col, '--size': ship.size }}
        >
          <img src={shipSrc(ship.size)} alt="" draggable={false} style={shipArtStyle(ship.size)} />
        </span>
      ))}
    </div>
  );
}

export const SeaGrid = forwardRef(function SeaGrid(
  { cells, ships = null, mode = 'view', fx = null, onCellPointerDown, onCellContextMenu },
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
      className={`sea${wide ? ' wide' : ''}${vast ? ' vast' : ''} ${live ? 'is-live' : ''} mode-${mode}${ships?.length ? ' has-ships' : ''}`}
      style={{ '--cols': colCount, '--rows': rowCount }}
      ref={ref}
    >
      <div className="sea-label" />
      {labels.map((col) => (
        <div key={col} className="sea-label">
          {col}
        </div>
      ))}
      {cells.map((row, rowIndex) => (
        <Fragment key={rowIndex}>
          <div className="sea-label">{rowIndex + 1}</div>
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
    </div>
  );
});
