import { Check, RotateCw, Shuffle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { shipArtStyle, shipSrc } from '../game/art';
import { SHIP_COLORS } from '../game/constants';
import {
  allPlaced,
  buildPlacementCells,
  canPlace,
  cellIndex,
  cellsFromGrid,
  fleetPayload,
  loadFleet,
  randomFleet,
  seaRules,
  shipAt,
} from '../game/placement';
import { Button } from '../components/Button';
import { SeaGrid } from '../components/SeaGrid';
import { useGame } from '../socket/GameProvider';

function rotateTarget(fleet, ship, scenario) {
  const orientation = ship.orientation === 'h' ? 'v' : 'h';
  if (ship.row === null || ship.col === null) {
    return { orientation, row: ship.row, col: ship.col };
  }
  const spots = [];
  for (let delta = 0; delta < ship.size; delta += 1) {
    spots.push({
      row: orientation === 'v' ? ship.row - delta : ship.row,
      col: orientation === 'h' ? ship.col - delta : ship.col,
    });
  }
  const rules = seaRules(scenario);
  const max = (orientation === 'v' ? rules.rows : rules.cols) - ship.size;
  spots.push({
    row: orientation === 'v' ? Math.min(Math.max(ship.row, 0), max) : ship.row,
    col: orientation === 'h' ? Math.min(Math.max(ship.col, 0), max) : ship.col,
  });
  const spot = spots.find((item) => canPlace(fleet, ship.id, item.row, item.col, orientation, scenario));
  if (!spot) return null;
  return { orientation, row: spot.row, col: spot.col };
}

export function PlacementScreen() {
  const { room, placeShips, error } = useGame();
  const gridRef = useRef(null);
  const fleetRef = useRef(null);
  const previewRef = useRef(null);
  const dragRef = useRef(null);
  const rotateRef = useRef(() => {});
  const scenarioRef = useRef(room.scenario);
  scenarioRef.current = room.scenario;
  const [fleet, setFleet] = useState(() => loadFleet(room.code, room.scenario));
  const [selectedId, setSelectedId] = useState(() => loadFleet(room.code, room.scenario)[0]?.id || 'ship-4-0');
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const locked = room.you.shipsConfirmed;

  fleetRef.current = fleet;

  function updatePreview(next) {
    previewRef.current = next;
    setPreview(next);
  }

  function pointToCell(x, y) {
    const root = gridRef.current;
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    if (x < rect.left || y < rect.top || x > rect.right || y > rect.bottom) return null;
    const direct = document.elementFromPoint(x, y)?.closest?.('[data-row]');
    if (direct && root.contains(direct)) {
      return { row: Number(direct.dataset.row), col: Number(direct.dataset.col) };
    }
    let best = null;
    let bestDist = 30;
    for (const node of root.querySelectorAll('[data-row]')) {
      const box = node.getBoundingClientRect();
      const cx = Math.min(Math.max(x, box.left), box.right);
      const cy = Math.min(Math.max(y, box.top), box.bottom);
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = node;
      }
    }
    if (!best) return null;
    return { row: Number(best.dataset.row), col: Number(best.dataset.col) };
  }

  useEffect(() => {
    if (locked) return undefined;
    sessionStorage.setItem(`ab_fleet_${room.code}`, JSON.stringify(fleet));
    return undefined;
  }, [fleet, locked, room.code]);

  useEffect(() => {
    function onMove(event) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true;
      const ship = fleetRef.current.find((item) => item.id === drag.shipId);
      if (!ship) return;
      const cell = pointToCell(event.clientX, event.clientY);
      if (!cell) {
        updatePreview(null);
        return;
      }
      const anchor =
        ship.orientation === 'h'
          ? { row: cell.row, col: cell.col - drag.grabIndex }
          : { row: cell.row - drag.grabIndex, col: cell.col };
      updatePreview({
        shipId: ship.id,
        size: ship.size,
        orientation: ship.orientation,
        row: anchor.row,
        col: anchor.col,
        valid: canPlace(fleetRef.current, ship.id, anchor.row, anchor.col, ship.orientation, scenarioRef.current),
      });
    }

    function onUp(event) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      const currentPreview = previewRef.current;
      updatePreview(null);
      if (!drag.moved) {
        setSelectedId(drag.shipId);
        return;
      }
      if (!currentPreview) {
        setFleet((current) =>
          current.map((ship) => (ship.id === drag.shipId ? { ...ship, row: null, col: null } : ship)),
        );
        setMessage('');
        return;
      }
      if (!currentPreview.valid) {
        setMessage('Bu konuma gemi yerleştirilemez.');
        return;
      }
      setMessage('');
      setSelectedId(drag.shipId);
      setFleet((current) =>
        current.map((ship) =>
          ship.id === drag.shipId
            ? {
                ...ship,
                row: currentPreview.row,
                col: currentPreview.col,
                orientation: currentPreview.orientation,
              }
            : ship,
        ),
      );
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key.toLowerCase() !== 'r') return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      rotateRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function startDrag(event, ship, grabIndex) {
    if (locked) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      shipId: ship.id,
      grabIndex,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setSelectedId(ship.id);
  }

  function placeSelected(row, col) {
    if (locked) return;
    const current = fleetRef.current;
    const occupying = shipAt(current, row, col);
    if (occupying) {
      setSelectedId(occupying.id);
      return;
    }
    const ship = current.find((item) => item.id === selectedId) || current.find((item) => item.row === null);
    if (!ship) return;
    if (!canPlace(current, ship.id, row, col, ship.orientation, room.scenario)) {
      setMessage('Bu konuma gemi yerleştirilemez.');
      return;
    }
    setMessage('');
    setSelectedId(ship.id);
    setFleet((items) => items.map((item) => (item.id === ship.id ? { ...item, row, col } : item)));
  }

  function rotate(forceId) {
    if (locked) return;
    const current = fleetRef.current;
    const id = typeof forceId === 'string' ? forceId : selectedId;
    const ship = current.find((item) => item.id === id);
    if (!ship) return;
    const next = rotateTarget(current, ship, room.scenario);
    setSelectedId(ship.id);
    if (!next) {
      setMessage('Bu konuma gemi yerleştirilemez.');
      return;
    }
    setMessage('');
    setFleet((items) => items.map((item) => (item.id === ship.id ? { ...item, ...next } : item)));
  }

  rotateRef.current = rotate;

  async function confirm() {
    if (!allPlaced(fleetRef.current, room.scenario) || sending || locked) return;
    setSending(true);
    const response = await placeShips(fleetPayload(fleetRef.current));
    setSending(false);
    if (!response.ok && !response.silent) {
      setMessage(response.message || 'Bu konuma gemi yerleştirilemez.');
    }
  }

  const placedCount = fleet.filter((ship) => ship.row !== null).length;
  const sprites = fleet
    .filter((ship) => ship.row !== null && ship.id !== preview?.shipId)
    .map((ship) => ({ ...ship, selected: ship.id === selectedId }));
  if (preview && preview.row < 10 && preview.col < 10 && preview.row > -preview.size && preview.col > -preview.size) {
    sprites.push({
      id: 'preview',
      size: preview.size,
      row: preview.row,
      col: preview.col,
      orientation: preview.orientation,
      ghost: preview.valid ? 'ok' : 'bad',
    });
  }
  const note = message || error;
  const opponentText = room.opponent?.shipsConfirmed
    ? `${room.opponent.name} hazır.`
    : `${room.opponent?.name || 'Rakip'} gemilerini yerleştiriyor.`;

  if (locked) {
    return (
      <section className="placement screen">
        <header className="screen-title">
          <p>FİLO HAZIR</p>
          <h2>Rakip bekleniyor</h2>
        </header>
        <p className="hint">{opponentText}</p>
        <div className="board-card glass">
          <SeaGrid cells={cellsFromGrid(room.you.board, room.scenario)} ships={fleet.filter((ship) => ship.row !== null)} mode="view" />
        </div>
      </section>
    );
  }

  return (
    <section className="placement screen">
      <header className="screen-title">
        <p>GEMİLERİNİ DİZ</p>
        <h2>
          {placedCount}/6 yerleştirildi
        </h2>
      </header>
      <p className="hint">Gemiyi seç, tahtaya tıkla veya sürükle. Döndür ile yönünü değiştir.</p>

      <div className="dock">
        {fleet.map((ship) => (
          <button
            key={ship.id}
            type="button"
            className={`dock-ship ${ship.row !== null ? 'placed' : ''} ${selectedId === ship.id ? 'selected' : ''}`}
            style={{ '--hull': SHIP_COLORS[ship.id] }}
            onPointerDown={(event) => startDrag(event, ship, 0)}
          >
            <span className={`dock-art ${ship.orientation === 'v' ? 'v' : ''}`}>
              <img src={shipSrc(ship.size)} alt="" draggable={false} style={shipArtStyle(ship.size)} />
            </span>
            <span>{ship.name}</span>
          </button>
        ))}
      </div>

      <div className="board-card glass">
        <SeaGrid
          ref={gridRef}
          cells={buildPlacementCells(fleet, preview, selectedId, room.scenario)}
          ships={sprites}
          mode="place"
          onCellPointerDown={(event, row, col) => {
            const occupying = shipAt(fleetRef.current, row, col);
            if (occupying) {
              startDrag(event, occupying, cellIndex(occupying, row, col));
              return;
            }
            placeSelected(row, col);
          }}
          onCellContextMenu={(row, col) => {
            const occupying = shipAt(fleetRef.current, row, col);
            rotateRef.current(occupying?.id);
          }}
        />
      </div>

      <p className={`hint ${note ? 'bad' : ''}`}>{note || opponentText}</p>

      <div className="action-row">
        <Button variant="ghost" icon={RotateCw} onClick={() => rotate()}>
          DÖNDÜR
        </Button>
        <Button variant="ghost" icon={Shuffle} onClick={() => { setFleet(randomFleet(room.scenario)); setMessage(''); }}>
          RASTGELE
        </Button>
        <Button
          variant="ghost"
          icon={Trash2}
          onClick={() => {
            setFleet((current) => current.map((ship) => ({ ...ship, row: null, col: null })));
            setMessage('');
          }}
        >
          TEMİZLE
        </Button>
      </div>
      <Button variant="green" icon={Check} disabled={!allPlaced(fleet, room.scenario) || sending} onClick={confirm}>
        HAZIRIM
      </Button>
    </section>
  );
}
