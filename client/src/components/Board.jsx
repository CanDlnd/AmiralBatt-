import { cellsFromGrid } from '../game/placement';
import { FleetStrip } from './FleetStrip';
import { SeaGrid } from './SeaGrid';

export function Board({ title, subtitle, grid, ships = null, fleet = null, fx, mode = 'view', active = false, onFire, className = '' }) {
  const cells = cellsFromGrid(grid);
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
        fx={fx}
        mode={mode}
        onCellPointerDown={mode === 'fire' ? (_event, row, col) => onFire?.(row, col) : undefined}
      />
    </section>
  );
}
