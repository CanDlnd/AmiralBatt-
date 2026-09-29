import { cellsFromGrid } from '../game/placement';
import { FleetStrip } from './FleetStrip';
import { SeaGrid } from './SeaGrid';

function fogPatches(grid, fog, veil, pins, side, fx) {
  if (!fog?.cells?.length || !grid) return [];
  return fog.cells.flatMap((cell) => {
    const kind = grid[cell.row]?.[cell.col];
    if (!kind || kind === 'rock') return [];
    const hidden = Boolean(veil?.has(`${side}:${cell.row}:${cell.col}`));
    return [{
      row: cell.row,
      col: cell.col,
      pin: kind === 'fogged' || Boolean(pins?.has(`${side}:${cell.row}:${cell.col}`)),
      leaving: Boolean(fog.clearing) && !hidden,
      splash: Boolean(
        fx?.result === 'fogged'
        && fx.cells?.some((item) => item.row === cell.row && item.col === cell.col),
      ),
      splashId: fx?.id || '',
    }];
  });
}

export function Board({ title, subtitle, grid, ships = null, fleet = null, fx, fog = null, veil = null, fogPins = null, side = 'you', lastMove = null, axisHover = false, mode = 'view', active = false, onFire, className = '' }) {
  const cells = cellsFromGrid(grid).map((row, rowIndex) => row.map((cell, colIndex) => (
    veil?.has(`${side}:${rowIndex}:${colIndex}`) ? { ...cell, locked: true } : cell
  )));
  const patches = fogPatches(grid, fog, veil, fogPins, side, fx);
  return (
    <section className={`board-card glass ${active ? 'active' : ''} ${className}`.trim()}>
      <header className="board-head">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
        <FleetStrip ships={fleet} />
      </header>
      <SeaGrid
        cells={cells}
        ships={ships}
        patches={patches}
        fx={fx}
        lastMove={lastMove}
        axisHover={axisHover}
        mode={mode}
        onCellPointerDown={mode === 'fire' ? (_event, row, col) => onFire?.(row, col) : undefined}
      />
    </section>
  );
}
