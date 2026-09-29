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
    decoys: { [playerA]: null, [playerB]: null },
    confirmed: { [playerA]: false, [playerB]: false },
    currentTurn: null,
    shots: [],
    winnerId: null,
    phase: 'placing',
    turnsDone: 0,
    targetFogTurn: 6 + Math.floor(Math.random() * 6),
    fogTriggered: false,
    fog: null,
  };
}

function touchesShip(occupied, row, col) {
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      if (occupied.has(`${row + dRow}:${col + dCol}`)) return true;
    }
  }
  return false;
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
        || touchesShip(occupied, cell.row, cell.col)
      ) {
        return { ok: false, message: 'Bu konuma gemi yerleştirilemez.' };
      }
    }
    for (const cell of cells) occupied.add(`${cell.row}:${cell.col}`);

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

export function validateDecoy(decoy, ships, scenarioId = 'classic', layout = null) {
  const scenario = activeScenario(scenarioId, layout);
  if (!decoy || typeof decoy !== 'object' || Array.isArray(decoy)) {
    return { ok: false, message: 'Şamandıranı yerleştir.' };
  }
  const { row, col } = decoy;
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return { ok: false, message: 'Şamandıranı yerleştir.' };
  }
  if (
    row < 0
    || col < 0
    || row >= scenario.rows
    || col >= scenario.cols
    || blockedSet(scenario).has(`${row}:${col}`)
  ) {
    return { ok: false, message: 'Bu konuma şamandıra yerleştirilemez.' };
  }
  const onShip = (ships || []).some((ship) =>
    shipCells(ship).some((cell) => cell.row === row && cell.col === col),
  );
  if (onShip) return { ok: false, message: 'Bu konuma şamandıra yerleştirilemez.' };
  return { ok: true, decoy: { row, col, triggered: false } };
}

export function placeShips(game, playerId, input, decoyInput) {
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
  const decoy = validateDecoy(decoyInput, check.ships, game.scenarioId, game.layout);
  if (!decoy.ok) return decoy;

  game.ships[playerId] = check.ships;
  game.decoys[playerId] = decoy.decoy;
  game.confirmed[playerId] = true;

  const bothReady = game.ids.every((id) => game.confirmed[id]);
  if (bothReady) {
    game.phase = 'battle';
    game.currentTurn = game.ids[0];
  }

  return { ok: true, bothReady };
}

function countsAsHit(shot) {
  return shot.result === 'hit' || shot.result === 'sunk';
}

function countsWhileHidden(shot) {
  return countsAsHit(shot) || (shot.concealed && shot.truth === 'hit');
}

function fleetStruck(ships, shots) {
  if (!ships?.length) return false;
  return ships.every((ship) =>
    shipCells(ship).every((cell) =>
      shots.some((shot) => shot.row === cell.row && shot.col === cell.col && countsWhileHidden(shot)),
    ),
  );
}

function shipAtCell(ships, row, col) {
  return (ships || []).find((ship) =>
    shipCells(ship).some((cell) => cell.row === row && cell.col === col),
  );
}

function hitsOnShip(ship, shots) {
  return shipCells(ship).filter((cell) =>
    shots.some((shot) => shot.row === cell.row && shot.col === cell.col && countsAsHit(shot)),
  ).length;
}

function isCapitalPanic(ship, shots) {
  if (!ship || ship.size < 4) return false;
  const hits = hitsOnShip(ship, shots);
  return hits === 1 || hits === 2;
}

export function isShipSunk(ship, shots) {
  return shipCells(ship).every((cell) =>
    shots.some((shot) => shot.row === cell.row && shot.col === cell.col && countsAsHit(shot)),
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
  const decoy = game.decoys?.[defenderId];
  if (decoy && !decoy.triggered && decoy.row === row && decoy.col === col) {
    shot.result = 'hit';
    shot.cells = [{ row, col }];
    decoy.triggered = true;
  }

  const veiled = inFog(game, row, col);
  if (veiled) {
    game.shots.push({
      shooterId: playerId,
      row,
      col,
      result: 'fogged',
      concealed: true,
      truth: shot.result === 'miss' ? 'miss' : 'hit',
    });
    if (shot.result !== 'miss' && fleetStruck(game.ships[defenderId], incomingShots(game, defenderId))) {
      const weather = revealFog(game);
      return {
        ok: true,
        shooterId: playerId,
        row,
        col,
        result: 'fogged',
        cells: [{ row, col }],
        currentTurn: game.currentTurn,
        winnerId: game.winnerId,
        gameOver: game.phase === 'finished',
        weather,
      };
    }
    game.currentTurn = defenderId;
    const weather = onTurnPassed(game);
    return {
      ok: true,
      shooterId: playerId,
      row,
      col,
      result: 'fogged',
      cells: [{ row, col }],
      currentTurn: game.currentTurn,
      winnerId: game.winnerId,
      gameOver: game.phase === 'finished',
      weather,
    };
  }

  game.shots.push({ shooterId: playerId, row, col, result: shot.result });
  const panic = shot.result === 'hit' && isCapitalPanic(
    shipAtCell(game.ships[defenderId], row, col),
    incomingShots(game, defenderId),
  );
  if (shot.result === 'sunk') stampHalo(game, defenderId, shot.cells, playerId);

  const remaining = countRemaining(game.ships[defenderId], incomingShots(game, defenderId), game.scenarioId);
  let weather = null;
  if (remaining === 0) {
    game.winnerId = playerId;
    game.phase = 'finished';
    game.currentTurn = null;
  } else if (shot.result === 'miss') {
    game.currentTurn = defenderId;
    weather = onTurnPassed(game);
  }

  return {
    ok: true,
    shooterId: playerId,
    row,
    col,
    result: shot.result,
    cells: shot.cells,
    panic,
    currentTurn: game.currentTurn,
    winnerId: game.winnerId,
    gameOver: game.phase === 'finished',
    weather,
  };
}

const FOG_TURNS = 4;

function inFog(game, row, col) {
  return Boolean(game.fog?.active && game.fog.cells.some((cell) => cell.row === row && cell.col === col));
}

function onTurnPassed(game) {
  if (game.phase !== 'battle') return null;
  game.turnsDone = (game.turnsDone || 0) + 1;
  if (game.fog?.active) {
    game.fog.remaining -= 1;
    if (game.fog.remaining <= 0) return revealFog(game);
    return null;
  }
  if (!game.fogTriggered && game.turnsDone === game.targetFogTurn) {
    game.fogTriggered = true;
    const cells = pickFogCells(game);
    if (!cells) return null;
    game.fog = { active: true, spent: false, cells, remaining: FOG_TURNS };
    return { type: 'start', cells, turns: FOG_TURNS };
  }
  return null;
}

function pickFogCells(game) {
  const scenario = activeScenario(game.scenarioId, game.layout);
  if (scenario.rows < 3 || scenario.cols < 3) return null;
  const blocked = blockedSet(scenario);
  const taken = new Set(game.shots.map((shot) => `${shot.row}:${shot.col}`));
  const options = [];
  for (let row = 1; row < scenario.rows - 1; row += 1) {
    for (let col = 1; col < scenario.cols - 1; col += 1) {
      const cells = [];
      let open = 0;
      for (let dRow = -1; dRow <= 1; dRow += 1) {
        for (let dCol = -1; dCol <= 1; dCol += 1) {
          const nextRow = row + dRow;
          const nextCol = col + dCol;
          const key = `${nextRow}:${nextCol}`;
          cells.push({ row: nextRow, col: nextCol });
          if (!blocked.has(key) && !taken.has(key)) open += 1;
        }
      }
      if (open > 0) options.push(cells);
    }
  }
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function shipKey(ship) {
  return shipCells(ship).map((cell) => `${cell.row}:${cell.col}`).join('|');
}

function sunkKeySet(game, playerId) {
  const keys = new Set();
  for (const ship of game.ships[playerId] || []) {
    if (isShipSunk(ship, incomingShots(game, playerId))) keys.add(shipKey(ship));
  }
  return keys;
}

function addedSizes(before, after) {
  const left = [...before];
  const added = [];
  for (const size of after) {
    const index = left.indexOf(size);
    if (index >= 0) left.splice(index, 1);
    else added.push(size);
  }
  return added;
}

function revealFog(game) {
  const before = new Map(
    game.ids.map((id) => [id, sunkSizes(game.ships[id], incomingShots(game, id))]),
  );
  const sequence = [];
  let winnerId = null;
  const pending = game.shots.filter((shot) => shot.concealed);

  for (const shot of pending) {
    const defenderId = game.ids.find((id) => id !== shot.shooterId);
    const sunkBefore = sunkKeySet(game, defenderId);
    shot.result = shot.truth === 'miss' ? 'miss' : 'hit';
    shot.concealed = false;
    delete shot.truth;
    const item = {
      shooterId: shot.shooterId,
      row: shot.row,
      col: shot.col,
      result: shot.result,
    };
    sequence.push(item);

    if (shot.result === 'hit') {
      if (isCapitalPanic(shipAtCell(game.ships[defenderId], shot.row, shot.col), incomingShots(game, defenderId))) {
        item.panic = true;
      }
      for (const ship of game.ships[defenderId] || []) {
        if (sunkBefore.has(shipKey(ship))) continue;
        if (!isShipSunk(ship, incomingShots(game, defenderId))) continue;
        item.sunk = true;
        const halo = stampHalo(game, defenderId, shipCells(ship), shot.shooterId);
        for (const cell of halo) {
          sequence.push({
            shooterId: shot.shooterId,
            row: cell.row,
            col: cell.col,
            result: 'miss',
            echo: true,
          });
        }
      }
    }

    if (
      !winnerId
      && countRemaining(game.ships[defenderId], incomingShots(game, defenderId), game.scenarioId) === 0
    ) {
      winnerId = shot.shooterId;
    }
  }

  game.fog.active = false;
  game.fog.spent = true;

  if (winnerId) {
    game.winnerId = winnerId;
    game.phase = 'finished';
    game.currentTurn = null;
  }

  const sunk = [];
  for (const id of game.ids) {
    const sizes = addedSizes(before.get(id) || [], sunkSizes(game.ships[id], incomingShots(game, id)));
    if (sizes.length) sunk.push({ playerId: id, sizes });
  }

  return {
    type: 'clear',
    sequence,
    revealedHits: sequence.filter((item) => item.result === 'hit').map(({ row, col }) => ({ row, col })),
    revealedMisses: sequence.filter((item) => item.result === 'miss').map(({ row, col }) => ({ row, col })),
    sunk,
  };
}

function stampHalo(game, defenderId, shipCellsHit, shooterId) {
  const added = [];
  const scenario = activeScenario(game.scenarioId, game.layout);
  const blocked = blockedSet(scenario);
  const hulls = new Set();
  for (const ship of game.ships[defenderId] || []) {
    for (const cell of shipCells(ship)) hulls.add(`${cell.row}:${cell.col}`);
  }
  const taken = new Set(incomingShots(game, defenderId).map((shot) => `${shot.row}:${shot.col}`));
  for (const cell of shipCellsHit) {
    for (let dRow = -1; dRow <= 1; dRow += 1) {
      for (let dCol = -1; dCol <= 1; dCol += 1) {
        const row = cell.row + dRow;
        const col = cell.col + dCol;
        const key = `${row}:${col}`;
        if (row < 0 || col < 0 || row >= scenario.rows || col >= scenario.cols) continue;
        if (blocked.has(key) || hulls.has(key) || taken.has(key)) continue;
        const decoy = game.decoys?.[defenderId];
        if (decoy && decoy.row === row && decoy.col === col) continue;
        taken.add(key);
        game.shots.push({ shooterId, row, col, result: 'miss' });
        added.push({ row, col });
      }
    }
  }
  return added;
}

export function isGameOver(game) {
  return Boolean(game && (game.phase === 'finished' || game.winnerId));
}

export function getWinner(game) {
  return game?.winnerId ?? null;
}

function paintShot(grid, shot, ships, shots) {
  if (!grid[shot.row] || grid[shot.row][shot.col] === 'rock') return;
  if (shot.concealed || shot.result === 'fogged') {
    grid[shot.row][shot.col] = 'fogged';
    return;
  }
  if (shot.result === 'miss') {
    grid[shot.row][shot.col] = 'miss';
    return;
  }
  const ship = ships.find((item) =>
    shipCells(item).some((cell) => cell.row === shot.row && cell.col === shot.col),
  );
  grid[shot.row][shot.col] = ship && isShipSunk(ship, shots) ? 'sunk' : 'hit';
}

function paintOwn(ships, shots, scenario, decoy) {
  const grid = emptyBoard('empty', scenario);
  paintTerrain(grid, scenario);
  if (!ships) return grid;

  for (const ship of ships) {
    for (const cell of shipCells(ship)) {
      grid[cell.row][cell.col] = 'ship';
    }
  }
  if (decoy && grid[decoy.row]?.[decoy.col] === 'empty') {
    grid[decoy.row][decoy.col] = 'decoy';
  }

  for (const shot of shots) {
    paintShot(grid, shot, ships, shots);
    if (
      decoy
      && shot.row === decoy.row
      && shot.col === decoy.col
      && !shot.concealed
      && shot.result !== 'fogged'
      && shot.result !== 'miss'
    ) {
      grid[shot.row][shot.col] = 'decoy-hit';
    }
  }

  return grid;
}

function paintEnemy(ships, shots, scenario) {
  const grid = emptyBoard('unknown', scenario);
  paintTerrain(grid, scenario);
  if (!ships) return grid;

  for (const shot of shots) {
    paintShot(grid, shot, ships, shots);
  }

  for (const row of grid) {
    for (const cell of row) {
      if (cell !== 'unknown' && cell !== 'miss' && cell !== 'hit' && cell !== 'sunk' && cell !== 'rock' && cell !== 'fogged') {
        throw new Error('Rakip tahtası sızdırıldı.');
      }
    }
  }

  return grid;
}

function revealFleet(ships, shots) {
  if (!ships) return [];
  return ships.map((ship, index) => ({
    id: `r${index}`,
    size: ship.size,
    row: ship.row,
    col: ship.col,
    facing: ship.orientation,
    sunk: isShipSunk(ship, shots),
  }));
}

export function buildBoards(game, viewerId) {
  const scenario = activeScenario(game.scenarioId, game.layout);
  const enemyId = game.ids.find((id) => id !== viewerId);
  const yourShots = incomingShots(game, viewerId);
  const enemyShots = incomingShots(game, enemyId);
  return {
    yourBoard: paintOwn(game.ships[viewerId], yourShots, scenario, game.decoys?.[viewerId]),
    enemyBoard: paintEnemy(game.ships[enemyId], enemyShots, scenario),
    yourRemaining: countRemaining(game.ships[viewerId], yourShots, scenario.id),
    enemyRemaining: countRemaining(game.ships[enemyId], enemyShots, scenario.id),
    yourSunk: sunkSizes(game.ships[viewerId], yourShots),
    enemySunk: sunkSizes(game.ships[enemyId], enemyShots),
    enemyReveal: game.phase === 'finished' ? revealFleet(game.ships[enemyId], enemyShots) : null,
    yourDecoy: publicDecoy(game.decoys?.[viewerId]),
    enemyDecoy: game.phase === 'finished' ? publicDecoy(game.decoys?.[enemyId]) : null,
  };
}

function publicDecoy(decoy) {
  if (!decoy || !Number.isInteger(decoy.row) || !Number.isInteger(decoy.col)) return null;
  return { row: decoy.row, col: decoy.col, triggered: Boolean(decoy.triggered) };
}
