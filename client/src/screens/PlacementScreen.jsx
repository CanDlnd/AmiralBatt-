import { Check, RotateCw, Shuffle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { shipArtStyle, shipSrc, BUOY_FLEET } from '../game/art';
import { SHIP_COLORS } from '../game/constants';
import {
  allPlaced,
  buildPlacementCells,
  canPlace,
  canPlaceDecoy,
  cellIndex,
  cellsFromGrid,
  decoyPayload,
  fleetPayload,
  loadDecoy,
  loadFleet,
  randomDecoy,
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
  const decoyRef = useRef(null);
  const previewRef = useRef(null);
  const dragRef = useRef(null);
  const rotateRef = useRef(() => { });
  const scenarioRef = useRef(room.scenario);
  scenarioRef.current = room.scenario;
  const [fleet, setFleet] = useState(() => loadFleet(room.code, room.scenario));
  const [decoy, setDecoy] = useState(() => loadDecoy(room.code, loadFleet(room.code, room.scenario), room.scenario));
  const [selectedId, setSelectedId] = useState(() => loadFleet(room.code, room.scenario)[0]?.id || 'ship-4-0');
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const locked = room.you.shipsConfirmed;

  fleetRef.current = fleet;
  decoyRef.current = decoy;

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
    sessionStorage.setItem(`ab_decoy_${room.code}`, JSON.stringify(decoy));
    return undefined;
  }, [fleet, decoy, locked, room.code]);

  useEffect(() => {
    function onMove(event) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true;
      const cell = pointToCell(event.clientX, event.clientY);
      if (!cell) {
        updatePreview(null);
        return;
      }
      if (drag.shipId === 'decoy') {
        updatePreview({
          shipId: 'decoy',
          size: 1,
          orientation: 'h',
          row: cell.row,
          col: cell.col,
          valid: canPlaceDecoy(fleetRef.current, cell.row, cell.col, scenarioRef.current),
        });
        return;
      }
      const ship = fleetRef.current.find((item) => item.id === drag.shipId);
      if (!ship) return;
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
      if (drag.shipId === 'decoy') {
        if (!currentPreview) {
          setDecoy(null);
          return;
        }
        if (!currentPreview.valid) {
          setMessage('Bu konuma şamandıra yerleştirilemez.');
          return;
        }
        setMessage('');
        setSelectedId('decoy');
        setDecoy({ row: currentPreview.row, col: currentPreview.col });
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
      setDecoy((current) => (
        current && shipAt(
          fleetRef.current.map((ship) => (
            ship.id === drag.shipId
              ? { ...ship, row: currentPreview.row, col: currentPreview.col, orientation: currentPreview.orientation }
              : ship
          )),
          current.row,
          current.col,
        )
          ? null
          : current
      ));
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

  function placeDecoy(row, col) {
    if (locked) return;
    if (shipAt(fleetRef.current, row, col) || !canPlaceDecoy(fleetRef.current, row, col, room.scenario)) {
      setMessage('Bu konuma şamandıra yerleştirilemez.');
      return;
    }
    setMessage('');
    setSelectedId('decoy');
    setDecoy({ row, col });
  }

  function placeSelected(row, col) {
    if (locked) return;
    if (selectedId === 'decoy') {
      placeDecoy(row, col);
      return;
    }
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
    const next = current.map((item) => (item.id === ship.id ? { ...item, row, col } : item));
    setFleet(next);
    setDecoy((marker) => (marker && shipAt(next, marker.row, marker.col) ? null : marker));
  }

  function rotate(forceId) {
    if (locked) return;
    const id = typeof forceId === 'string' ? forceId : selectedId;
    if (id === 'decoy') return;
    const current = fleetRef.current;
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
    setDecoy((marker) => {
      if (!marker) return marker;
      const moved = fleetRef.current.map((item) => (item.id === ship.id ? { ...item, ...next } : item));
      return shipAt(moved, marker.row, marker.col) ? null : marker;
    });
  }

  rotateRef.current = rotate;

  async function confirm() {
    if (!allPlaced(fleetRef.current, room.scenario) || !decoyRef.current || sending || locked) return;
    setSending(true);
    const response = await placeShips(fleetPayload(fleetRef.current), decoyPayload(decoyRef.current));
    setSending(false);
    if (!response.ok && !response.silent) {
      setMessage(response.message || 'Bu konuma gemi yerleştirilemez.');
    }
  }

  function buoySprite(marker, id, ghost) {
    if (!marker || !Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return null;
    return {
      id,
      size: 1,
      row: marker.row,
      col: marker.col,
      orientation: 'h',
      buoy: true,
      broken: Boolean(marker.triggered),
      selected: selectedId === 'decoy' && !ghost,
      ghost,
    };
  }

  const placedCount = fleet.filter((ship) => ship.row !== null).length;
  const sprites = fleet
    .filter((ship) => ship.row !== null && ship.id !== preview?.shipId)
    .map((ship) => ({ ...ship, selected: ship.id === selectedId }));
  if (preview && preview.row > -preview.size && preview.col > -preview.size && preview.row < seaRules(room.scenario).rows && preview.col < seaRules(room.scenario).cols) {
    sprites.push({
      id: 'preview',
      size: preview.size,
      row: preview.row,
      col: preview.col,
      orientation: preview.orientation,
      ghost: preview.valid ? 'ok' : 'bad',
      buoy: preview.shipId === 'decoy',
    });
  }
  const placedBuoy = preview?.shipId === 'decoy' ? null : buoySprite(decoy, 'decoy');
  if (placedBuoy) sprites.push(placedBuoy);
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
          <SeaGrid
            cells={cellsFromGrid(room.you.board, room.scenario)}
            ships={[
              ...fleet.filter((ship) => ship.row !== null),
              ...(buoySprite(room.you.decoy || decoy, 'decoy') ? [buoySprite(room.you.decoy || decoy, 'decoy')] : []),
            ]}
            mode="view"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="placement placement-setup screen">
      <header className="screen-title">
        <p>GEMİLERİNİ DİZ</p>
        <h2>
          {placedCount}/6 yerleştirildi
        </h2>
        {room.you.score || room.opponent?.score ? (
          <p className="room-score">Oda skoru {room.you.score || 0} – {room.opponent?.score || 0}</p>
        ) : null}
      </header>
      <p className="hint">Gemiyi seç, tahtaya tıkla veya sürükle. Blöf şamandırasını boş bir kareye koy.</p>

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
        <button
          type="button"
          className={`dock-ship buoy ${decoy ? 'placed' : ''} ${selectedId === 'decoy' ? 'selected' : ''}`}
          aria-label="Blöf Şamandırası"
          onPointerDown={(event) => {
            if (locked) return;
            event.preventDefault();
            dragRef.current = {
              pointerId: event.pointerId,
              shipId: 'decoy',
              grabIndex: 0,
              startX: event.clientX,
              startY: event.clientY,
              moved: false,
            };
            setSelectedId('decoy');
          }}
        >
          <span className="dock-art buoy">
            <img src={BUOY_FLEET} alt="" draggable={false} />
          </span>
          <span>Blöf</span>
        </button>
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
            if (decoyRef.current && decoyRef.current.row === row && decoyRef.current.col === col) {
              event.preventDefault();
              dragRef.current = {
                pointerId: event.pointerId,
                shipId: 'decoy',
                grabIndex: 0,
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
              };
              setSelectedId('decoy');
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
        <Button variant="ghost" icon={Shuffle} onClick={() => {
          const next = randomFleet(room.scenario);
          setFleet(next);
          setDecoy(randomDecoy(next, room.scenario));
          setMessage('');
        }}>
          RASTGELE
        </Button>
        <Button
          variant="ghost"
          icon={Trash2}
          onClick={() => {
            setFleet((current) => current.map((ship) => ({ ...ship, row: null, col: null })));
            setDecoy(null);
            setMessage('');
          }}
        >
          TEMİZLE
        </Button>
        <Button variant="green" icon={Check} disabled={!allPlaced(fleet, room.scenario) || !decoy || sending} onClick={confirm}>
          HAZIRIM
        </Button>
      </div>
    </section>
  );
}
