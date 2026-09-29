import { FLEET_TEMPLATE, GRID_SIZE, SHIP_COLORS } from './constants';

export function seaRules(scenario) {
  const fleet = scenario?.fleet?.length ? scenario.fleet : FLEET_TEMPLATE;
  return {
    rows: scenario?.rows || GRID_SIZE,
    cols: scenario?.cols || GRID_SIZE,
    fleet,
    blocked: new Set((scenario?.blocked || []).map((cell) => `${cell[0]}:${cell[1]}`)),
  };
}

function inSea(rules, row, col) {
  return row >= 0 && col >= 0 && row < rules.rows && col < rules.cols && !rules.blocked.has(`${row}:${col}`);
}

export function freshFleet(scenario) {
  return seaRules(scenario).fleet.map((ship) => ({
    ...ship,
    row: null,
    col: null,
    orientation: 'h',
  }));
}

export function cellsFor(row, col, size, orientation) {
  const cells = [];
  for (let index = 0; index < size; index += 1) {
    cells.push(orientation === 'h' ? { row, col: col + index } : { row: row + index, col });
  }
  return cells;
}

export function canPlace(fleet, shipId, row, col, orientation, scenario) {
  const rules = seaRules(scenario);
  const ship = fleet.find((item) => item.id === shipId);
  if (!ship || !Number.isInteger(row) || !Number.isInteger(col)) return false;
  if (orientation !== 'h' && orientation !== 'v') return false;
  const cells = cellsFor(row, col, ship.size, orientation);
  if (cells.some((cell) => !inSea(rules, cell.row, cell.col))) {
    return false;
  }
  const occupied = new Set();
  for (const other of fleet) {
    if (other.id === shipId || other.row === null || other.col === null) continue;
    for (const cell of cellsFor(other.row, other.col, other.size, other.orientation)) {
      occupied.add(`${cell.row},${cell.col}`);
    }
  }
  return cells.every((cell) => !touchesShip(occupied, cell.row, cell.col));
}

function touchesShip(occupied, row, col) {
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      if (occupied.has(`${row + dRow},${col + dCol}`)) return true;
    }
  }
  return false;
}

export function allPlaced(fleet, scenario) {
  const rules = seaRules(scenario);
  return (
    fleet.length === rules.fleet.length &&
    fleet.every((ship) => ship.row !== null && ship.col !== null && canPlace(fleet, ship.id, ship.row, ship.col, ship.orientation, scenario))
  );
}

export function shipAt(fleet, row, col) {
  return fleet.find((ship) => {
    if (ship.row === null || ship.col === null) return false;
    return cellsFor(ship.row, ship.col, ship.size, ship.orientation).some((cell) => cell.row === row && cell.col === col);
  });
}

export function cellIndex(ship, row, col) {
  return ship.orientation === 'h' ? col - ship.col : row - ship.row;
}

export function canPlaceDecoy(fleet, row, col, scenario) {
  const rules = seaRules(scenario);
  if (!Number.isInteger(row) || !Number.isInteger(col) || !inSea(rules, row, col)) return false;
  return !shipAt(fleet, row, col);
}

export function randomDecoy(fleet, scenario) {
  const rules = seaRules(scenario);
  const open = [];
  for (let row = 0; row < rules.rows; row += 1) {
    for (let col = 0; col < rules.cols; col += 1) {
      if (canPlaceDecoy(fleet, row, col, scenario)) open.push({ row, col });
    }
  }
  if (!open.length) return null;
  return open[Math.floor(Math.random() * open.length)];
}

export function loadDecoy(code, fleet, scenario) {
  try {
    const raw = JSON.parse(sessionStorage.getItem(`ab_decoy_${code}`) || 'null');
    if (!raw || !Number.isInteger(raw.row) || !Number.isInteger(raw.col)) return null;
    return canPlaceDecoy(fleet, raw.row, raw.col, scenario) ? { row: raw.row, col: raw.col } : null;
  } catch {
    return null;
  }
}

export function decoyPayload(decoy) {
  if (!decoy) return null;
  return { row: decoy.row, col: decoy.col };
}

export function fleetPayload(fleet) {
  return fleet.map((ship) => ({
    size: ship.size,
    row: ship.row,
    col: ship.col,
    orientation: ship.orientation,
  }));
}

export function cellsFromGrid(grid, scenario) {
  const rules = seaRules(scenario);
  const source =
    grid ||
    Array.from({ length: rules.rows }, () => Array.from({ length: rules.cols }, () => 'unknown'));
  return source.map((row, rowIndex) => row.map((kind, colIndex) => {
    if (rules.blocked.has(`${rowIndex}:${colIndex}`)) return { kind: 'rock' };
    return { kind: kind === 'empty' ? 'water' : kind };
  }));
}

export function buildPlacementCells(fleet, preview, selectedId, scenario) {
  const rules = seaRules(scenario);
  const cells = Array.from({ length: rules.rows }, () =>
    Array.from({ length: rules.cols }, () => ({ kind: 'water' })),
  );
  for (const key of rules.blocked) {
    const [row, col] = key.split(':').map(Number);
    cells[row][col] = { kind: 'rock' };
  }
  const hiddenId = preview?.shipId;

  for (const ship of fleet) {
    if (ship.row === null || ship.col === null || ship.id === hiddenId) continue;
    cellsFor(ship.row, ship.col, ship.size, ship.orientation).forEach((cell, index) => {
      cells[cell.row][cell.col] = {
        kind: 'ship',
        color: SHIP_COLORS[ship.id],
        selected: ship.id === selectedId,
        bow: index === 0,
      };
    });
  }

  if (preview) {
    for (const cell of cellsFor(preview.row, preview.col, preview.size, preview.orientation)) {
      if (!inSea(rules, cell.row, cell.col)) continue;
      cells[cell.row][cell.col] = { kind: preview.valid ? 'ok' : 'bad' };
    }
  }

  return cells;
}

export function randomFleet(scenario) {
  const rules = seaRules(scenario);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const fleet = freshFleet(scenario);
    let ok = true;
    for (const ship of fleet) {
      let placed = false;
      for (let tryIndex = 0; tryIndex < 240 && !placed; tryIndex += 1) {
        const orientation = Math.random() < 0.5 ? 'h' : 'v';
        const rowMax = orientation === 'v' ? rules.rows - ship.size + 1 : rules.rows;
        const colMax = orientation === 'h' ? rules.cols - ship.size + 1 : rules.cols;
        const row = Math.floor(Math.random() * rowMax);
        const col = Math.floor(Math.random() * colMax);
        if (canPlace(fleet, ship.id, row, col, orientation, scenario)) {
          ship.row = row;
          ship.col = col;
          ship.orientation = orientation;
          placed = true;
        }
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return fleet;
  }
  return freshFleet(scenario);
}

export function loadFleet(code, scenario) {
  const rules = seaRules(scenario);
  try {
    const raw = JSON.parse(sessionStorage.getItem(`ab_fleet_${code}`) || 'null');
    if (!Array.isArray(raw)) return freshFleet(scenario);
    const fleet = rules.fleet.map((template) => {
      const saved = raw.find((item) => item && item.id === template.id);
      const orientation = saved?.orientation === 'v' ? 'v' : 'h';
      const row = Number.isInteger(saved?.row) ? saved.row : null;
      const col = Number.isInteger(saved?.col) ? saved.col : null;
      return { ...template, orientation, row, col };
    });
    const valid = fleet.every(
      (ship) => ship.row === null || canPlace(fleet, ship.id, ship.row, ship.col, ship.orientation, scenario),
    );
    return valid ? fleet : freshFleet(scenario);
  } catch {
    return freshFleet(scenario);
  }
}
