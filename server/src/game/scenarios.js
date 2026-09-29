import { randomInt } from 'crypto';

function fleetFrom(sizes, names) {
  const seen = {};
  return sizes.map((size, index) => {
    const nth = seen[size] || 0;
    seen[size] = nth + 1;
    return {
      id: `ship-${size}-${nth}`,
      size,
      name: names[index],
    };
  });
}

function range(rowStart, rowEnd, cols) {
  const cells = [];
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (const col of cols) cells.push([row, col]);
  }
  return cells;
}

const COVE_LAYOUTS = [
  [...range(2, 9, [0, 8, 9]), [5, 3], [6, 5]],
  [...range(2, 9, [0, 1, 9]), [4, 6], [7, 3]],
  [...range(4, 9, [0, 1, 2]), ...range(2, 9, [9]), [3, 5], [7, 6]],
  [...range(3, 9, [0]), ...range(2, 9, [9]), ...range(5, 9, [8]), ...range(7, 9, [7]), [4, 3], [6, 4]],
];

const COVE_MIN_ROWS = 7;
const COVE_MAX_ROWS = 13;
const COVE_MIN_COLS = 6;
const COVE_MAX_COLS = 13;

function coastKey(layout) {
  if (!layout) return '';
  const blocked = Array.isArray(layout) ? layout : layout.blocked;
  if (!Array.isArray(blocked)) return '';
  const size = Array.isArray(layout) ? '' : `${layout.rows}x${layout.cols}|`;
  return size + blocked.map(([row, col]) => `${row}:${col}`).sort().join('|');
}

function coveBlocked() {
  return COVE_LAYOUTS[0].map(([row, col]) => [row, col]);
}

function buildCoast(rows, cols) {
  const blocked = [];
  let left = randomInt(0, Math.min(3, cols - 4));
  let right = randomInt(0, Math.max(1, Math.min(3, cols - 4 - left)));
  const banks = [];

  for (let row = 0; row < rows; row += 1) {
    if (row > 0) {
      left = Math.max(0, left + randomInt(-1, 2));
      right = Math.max(0, right + randomInt(-1, 2));
    }
    while (left + right > cols - 4) {
      if (left > right) left -= 1;
      else right -= 1;
    }
    banks.push([left, right]);
    for (let col = 0; col < left; col += 1) blocked.push([row, col]);
    for (let col = 0; col < right; col += 1) blocked.push([row, cols - 1 - col]);
  }

  const taken = new Set(blocked.map(([row, col]) => `${row}:${col}`));
  const isletBudget = randomInt(1, Math.min(4, Math.max(2, Math.floor(rows / 3) + 1)));
  let placed = 0;
  for (let guard = 0; guard < 48 && placed < isletBudget; guard += 1) {
    const row = randomInt(1, rows);
    const [leftBank, rightBank] = banks[row];
    const seaStart = leftBank;
    const seaEnd = cols - rightBank;
    const width = seaEnd - seaStart;
    if (width < 6) continue;
    const pad = Math.floor((width - 4) / 2);
    const center = seaStart + pad;
    const onLeft = Math.random() < 0.5;
    const col = onLeft ? seaStart + randomInt(0, pad) : seaEnd - 1 - randomInt(0, pad);
    if (col >= center && col < center + 4) continue;
    const key = `${row}:${col}`;
    if (taken.has(key)) continue;
    taken.add(key);
    blocked.push([row, col]);
    placed += 1;
  }

  return blocked;
}

function touchesFleet(ships, row, col) {
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      if (ships.has(`${row + dRow}:${col + dCol}`)) return true;
    }
  }
  return false;
}

function fleetFits(rows, cols, blocked) {
  const rocks = new Set(blocked.map(([row, col]) => `${row}:${col}`));
  const sizes = [4, 3, 3, 2, 2, 1];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ships = new Set();
    let ok = true;
    for (const size of sizes) {
      let placed = false;
      for (let tryIndex = 0; tryIndex < 80 && !placed; tryIndex += 1) {
        const orientation = Math.random() < 0.5 ? 'h' : 'v';
        const rowMax = orientation === 'v' ? rows - size + 1 : rows;
        const colMax = orientation === 'h' ? cols - size + 1 : cols;
        if (rowMax <= 0 || colMax <= 0) continue;
        const row = randomInt(0, rowMax);
        const col = randomInt(0, colMax);
        const cells = [];
        let hit = false;
        for (let index = 0; index < size; index += 1) {
          const cellRow = orientation === 'h' ? row : row + index;
          const cellCol = orientation === 'h' ? col + index : col;
          const key = `${cellRow}:${cellCol}`;
          if (rocks.has(key) || touchesFleet(ships, cellRow, cellCol)) hit = true;
          cells.push(key);
        }
        if (hit) continue;
        for (const key of cells) ships.add(key);
        placed = true;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function safeCove(rows, cols) {
  const blocked = [];
  for (let row = 2; row < rows; row += 1) {
    blocked.push([row, 0], [row, cols - 1]);
  }
  if (rows > 5 && cols > 5) blocked.push([Math.floor(rows / 2), Math.floor(cols / 2)]);
  return { rows, cols, blocked };
}

export function pickCoveLayout(current) {
  const previous = current && !Array.isArray(current) ? current : null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const rows = randomInt(COVE_MIN_ROWS, COVE_MAX_ROWS + 1);
    const cols = randomInt(COVE_MIN_COLS, COVE_MAX_COLS + 1);
    const blocked = buildCoast(rows, cols);
    const layout = { rows, cols, blocked };
    if (!fleetFits(rows, cols, blocked)) continue;
    if (previous && coastKey(layout) === coastKey(previous)) continue;
    return layout;
  }
  const fallback = safeCove(10, 10);
  if (fleetFits(fallback.rows, fallback.cols, fallback.blocked)) return fallback;
  return { rows: 10, cols: 10, blocked: [] };
}

const SCENARIOS = [
  {
    id: 'classic',
    name: 'Klasik',
    detail: 'Düz 10×10 deniz. Bildiğin filo.',
    rows: 10,
    cols: 10,
    fleet: fleetFrom(
      [4, 3, 3, 2, 2, 1],
      ['Amiral', 'Kruvazör', 'Kruvazör', 'Muhrip', 'Muhrip', 'Devriye'],
    ),
    blocked: [],
  },
  {
    id: 'cove',
    name: 'Koy',
    detail: 'Satır 7–13, sütun F–M. Her maçta boyu ve kıyısı değişir.',
    rows: 10,
    cols: 10,
    fleet: fleetFrom(
      [4, 3, 3, 2, 2, 1],
      ['Amiral', 'Kruvazör', 'Kruvazör', 'Muhrip', 'Muhrip', 'Devriye'],
    ),
    blocked: coveBlocked(),
  },
  {
    id: 'open',
    name: 'Açık deniz',
    detail: '12×12 deniz. Daha büyük filo, daha uzun maç.',
    rows: 12,
    cols: 12,
    fleet: fleetFrom(
      [5, 4, 3, 3, 2, 2],
      ['Amiral', 'Kruvazör', 'Fırkateyn', 'Fırkateyn', 'Muhrip', 'Muhrip'],
    ),
    blocked: [],
  },
];

const byId = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function getScenario(id) {
  return byId.get(id) || byId.get('classic');
}

export function listScenarios() {
  return SCENARIOS.map(({ id, name, detail }) => ({ id, name, detail }));
}

export function publicScenario(id, layout) {
  const scenario = getScenario(id);
  const cove = scenario.id === 'cove' && layout && !Array.isArray(layout) && layout.blocked?.length;
  const legacy = scenario.id === 'cove' && Array.isArray(layout) && layout.length;
  const blocked = cove ? layout.blocked : legacy ? layout : scenario.blocked;
  return {
    id: scenario.id,
    name: scenario.name,
    detail: scenario.detail,
    rows: cove ? layout.rows : scenario.rows,
    cols: cove ? layout.cols : scenario.cols,
    fleet: scenario.fleet,
    blocked: blocked.map(([row, col]) => [row, col]),
  };
}

export function blockedSet(scenario) {
  return new Set(scenario.blocked.map(([row, col]) => `${row}:${col}`));
}
