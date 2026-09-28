import { blockedSet, getScenario } from './scenarios.js';

export function shipCells(ship) {
  const cells = [];
  for (let i = 0; i < ship.size; i += 1) {
    cells.push(
      ship.orientation === 'h'
        ? { row: ship.row, col: ship.col + i }
        : { row: ship.row + i, col: ship.col },
    );
  }
  return cells;
}

export function emptyBoard(fill, scenarioOrId = 'classic') {
  const scenario = scenarioOrId && typeof scenarioOrId === 'object'
    ? scenarioOrId
    : getScenario(scenarioOrId);
  return Array.from({ length: scenario.rows }, () => Array.from({ length: scenario.cols }, () => fill));
}

function paintTerrain(grid, scenario) {
  const blocked = blockedSet(scenario);
  for (let row = 0; row < scenario.rows; row += 1) {
    for (let col = 0; col < scenario.cols; col += 1) {
      if (blocked.has(`${row}:${col}`)) grid[row][col] = 'rock';
    }
  }
}

function copyCoast(layout, scenario) {
  if (Array.isArray(layout) && layout.length) {
    return {
      rows: scenario.rows,
      cols: scenario.cols,
      blocked: layout.map(([row, col]) => [row, col]),
    };
  }
  if (layout?.blocked?.length) {
    return {
      rows: layout.rows,
      cols: layout.cols,
      blocked: layout.blocked.map(([row, col]) => [row, col]),
    };
  }
  return {
    rows: scenario.rows,
    cols: scenario.cols,
    blocked: scenario.blocked.map(([row, col]) => [row, col]),
  };
}

function activeScenario(scenarioId = 'classic', layout = null) {
  const scenario = getScenario(scenarioId);
  if (scenario.id !== 'cove' || !layout) return scenario;
  if (Array.isArray(layout)) {
    if (!layout.length) return scenario;
    return { ...scenario, blocked: layout };
  }
  if (!layout.blocked?.length) return scenario;
  return { ...scenario, rows: layout.rows, cols: layout.cols, blocked: layout.blocked };
}

export function createGame(playerA, playerB, scenarioId = 'classic', layout = null) {
  const scenario = getScenario(scenarioId);
  return {
    ids: [playerA, playerB],
    scenarioId: scenario.id,
    layout: scenario.id === 'cove' ? copyCoast(layout, scenario) : null,
    ships: { [playerA]: null, [playerB]: null },
    confirmed: { [playerA]: false, [playerB]: false },
    currentTurn: null,
    shots: [],
    winnerId: null,
    phase: 'placing',
  };
}

export function validateShips(input, scenarioId = 'classic', layout = null) {
  const scenario = activeScenario(scenarioId, layout);
  const blocked = blockedSet(scenario);
  if (!Array.isArray(input) || input.length !== scenario.fleet.length) {
    return { ok: false, message: 'Gemi filosu hatalı.' };
  }

  const expected = {};
  for (const ship of scenario.fleet) expected[ship.size] = (expected[ship.size] || 0) + 1;
  const counts = {};
  const occupied = new Set();
  const ships = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, message: 'Geçersiz gemi yerleşimi.' };
    }

    const { size, row, col, orientation } = raw;
    if (!Number.isInteger(size) || !expected[size]) {
      return { ok: false, message: 'Gemi filosu hatalı.' };
    }
    if (orientation !== 'h' && orientation !== 'v') {
      return { ok: false, message: 'Geçersiz gemi yerleşimi.' };
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      return { ok: false, message: 'Geçersiz gemi yerleşimi.' };
    }

    const cells = shipCells({ size, row, col, orientation });
    for (const cell of cells) {
      const key = `${cell.row}:${cell.col}`;
      if (
        cell.row < 0
        || cell.col < 0
        || cell.row >= scenario.rows
        || cell.col >= scenario.cols
        || blocked.has(key)
        || occupied.has(key)
      ) {
        return { ok: false, message: 'Bu konuma gemi yerleştirilemez.' };
      }
      occupied.add(key);
    }

    counts[size] = (counts[size] || 0) + 1;
    ships.push({
      id: `ship-${size}-${counts[size]}`,
      size,
      row,
      col,
      orientation,
    });
  }

  for (const size of Object.keys(expected)) {
    if (counts[size] !== expected[size]) {
      return { ok: false, message: 'Gemi filosu hatalı.' };
    }
  }

  return { ok: true, ships };
}

export function placeShips(game, playerId, input) {
  if (!game || game.phase !== 'placing') {
    return { ok: false, message: 'Gemi yerleştirme kapalı.' };
  }
  if (!game.ids.includes(playerId)) {
    return { ok: false, message: 'Bu işlem için odada olmalısın.' };
  }
  if (game.confirmed[playerId]) {
    return { ok: false, message: 'Yerleşimin zaten onaylandı.' };
  }

  const check = validateShips(input, game.scenarioId, game.layout);
  if (!check.ok) return check;

  game.ships[playerId] = check.ships;
  game.confirmed[playerId] = true;

  const bothReady = game.ids.every((id) => game.confirmed[id]);
  if (bothReady) {
    game.phase = 'battle';
    game.currentTurn = game.ids[0];
  }

  return { ok: true, bothReady };
}

export function isShipSunk(ship, shots) {
  return shipCells(ship).every((cell) =>
    shots.some((shot) => shot.row === cell.row && shot.col === cell.col && shot.result !== 'miss'),
  );
}

export function incomingShots(game, playerId) {
  return game.shots.filter((shot) => shot.shooterId !== playerId);
}

export function countRemaining(ships, shots, scenarioId = 'classic') {
  if (!ships) return getScenario(scenarioId).fleet.length;
  return ships.filter((ship) => !isShipSunk(ship, shots)).length;
}

export function sunkSizes(ships, shots) {
  if (!ships) return [];
  return ships.filter((ship) => isShipSunk(ship, shots)).map((ship) => ship.size);
}

export function getShotResult(ships, priorShots, row, col, scenarioId = 'classic', layout = null) {
  const scenario = activeScenario(scenarioId, layout);
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    col < 0 ||
    row >= scenario.rows ||
    col >= scenario.cols
  ) {
    return { ok: false, message: 'Geçersiz koordinat.' };
  }
  if (blockedSet(scenario).has(`${row}:${col}`)) {
    return { ok: false, message: 'Buraya ateş edilemez.' };
  }
  if (priorShots.some((shot) => shot.row === row && shot.col === col)) {
    return { ok: false, message: 'Bu hücreye zaten ateş edildi.' };
  }
  if (!ships) {
    return { ok: false, message: 'Rakip henüz hazır değil.' };
  }

  const hitShip = ships.find((ship) =>
    shipCells(ship).some((cell) => cell.row === row && cell.col === col),
  );

  if (!hitShip) {
    return { ok: true, result: 'miss', cells: [{ row, col }] };
  }

  const nextShots = priorShots.concat([{ row, col, result: 'hit' }]);
  if (isShipSunk(hitShip, nextShots)) {
    return { ok: true, result: 'sunk', cells: shipCells(hitShip) };
  }
  return { ok: true, result: 'hit', cells: [{ row, col }] };
}

export function fireShot(game, playerId, row, col) {
  if (!game || game.phase !== 'battle') {
    return { ok: false, message: 'Şu an ateş edilemez.' };
  }
  if (!game.ids.includes(playerId)) {
    return { ok: false, message: 'Bu işlem için odada olmalısın.' };
  }
  if (game.currentTurn !== playerId) {
    return { ok: false, message: 'Sıra sende değil.' };
  }

  const defenderId = game.ids.find((id) => id !== playerId);
  const prior = incomingShots(game, defenderId);
  const shot = getShotResult(game.ships[defenderId], prior, row, col, game.scenarioId, game.layout);
  if (!shot.ok) return shot;

  game.shots.push({ shooterId: playerId, row, col, result: shot.result });

  const remaining = countRemaining(game.ships[defenderId], incomingShots(game, defenderId), game.scenarioId);
  if (remaining === 0) {
    game.winnerId = playerId;
    game.phase = 'finished';
    game.currentTurn = null;
  } else if (shot.result === 'miss') {
    game.currentTurn = defenderId;
  }

  return {
    ok: true,
    shooterId: playerId,
    row,
    col,
    result: shot.result,
    cells: shot.cells,
    currentTurn: game.currentTurn,
    winnerId: game.winnerId,
    gameOver: game.phase === 'finished',
  };
}

export function isGameOver(game) {
  return Boolean(game && (game.phase === 'finished' || game.winnerId));
}

export function getWinner(game) {
  return game?.winnerId ?? null;
}

function paintOwn(ships, shots, scenario) {
  const grid = emptyBoard('empty', scenario);
  paintTerrain(grid, scenario);
  if (!ships) return grid;

  for (const ship of ships) {
    for (const cell of shipCells(ship)) {
      grid[cell.row][cell.col] = 'ship';
    }
  }

  for (const shot of shots) {
    if (shot.result === 'miss') {
      grid[shot.row][shot.col] = 'miss';
      continue;
    }
    const ship = ships.find((item) =>
      shipCells(item).some((cell) => cell.row === shot.row && cell.col === shot.col),
    );
    grid[shot.row][shot.col] = ship && isShipSunk(ship, shots) ? 'sunk' : 'hit';
  }

  return grid;
}

function paintEnemy(ships, shots, scenario) {
  const grid = emptyBoard('unknown', scenario);
  paintTerrain(grid, scenario);
  if (!ships) return grid;

  for (const shot of shots) {
    if (shot.result === 'miss') {
      grid[shot.row][shot.col] = 'miss';
      continue;
    }
    const ship = ships.find((item) =>
      shipCells(item).some((cell) => cell.row === shot.row && cell.col === shot.col),
    );
    grid[shot.row][shot.col] = ship && isShipSunk(ship, shots) ? 'sunk' : 'hit';
  }

  for (const row of grid) {
    for (const cell of row) {
      if (cell !== 'unknown' && cell !== 'miss' && cell !== 'hit' && cell !== 'sunk' && cell !== 'rock') {
        throw new Error('Rakip tahtası sızdırıldı.');
      }
    }
  }

  return grid;
}

export function buildBoards(game, viewerId) {
  const scenario = activeScenario(game.scenarioId, game.layout);
  const enemyId = game.ids.find((id) => id !== viewerId);
  const yourShots = incomingShots(game, viewerId);
  const enemyShots = incomingShots(game, enemyId);
  return {
    yourBoard: paintOwn(game.ships[viewerId], yourShots, scenario),
    enemyBoard: paintEnemy(game.ships[enemyId], enemyShots, scenario),
    yourRemaining: countRemaining(game.ships[viewerId], yourShots, scenario.id),
    enemyRemaining: countRemaining(game.ships[enemyId], enemyShots, scenario.id),
    yourSunk: sunkSizes(game.ships[viewerId], yourShots),
    enemySunk: sunkSizes(game.ships[enemyId], enemyShots),
  };
}
