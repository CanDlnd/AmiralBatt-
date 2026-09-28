import { shipArtStyle, shipSrc } from '../game/art';

export function fleetStatus(fleet, sunkSizes = []) {
  const bag = [...sunkSizes];
  return (fleet || []).map((ship) => {
    const index = bag.indexOf(ship.size);
    const sunk = index !== -1;
    if (sunk) bag.splice(index, 1);
    return { ...ship, sunk };
  });
}

export function FleetStrip({ ships }) {
  if (!ships?.length) return null;
  const sunkCount = ships.filter((ship) => ship.sunk).length;
  return (
    <div className="fleet-strip" aria-label={`Filo, ${sunkCount} gemi battı`}>
      {ships.map((ship) => (
        <span
          key={ship.id}
          className={`fleet-ship${ship.sunk ? ' is-sunk' : ''}`}
          title={ship.sunk ? `${ship.name} battı` : ship.name}
        >
          <span className="fleet-art" style={{ '--size': ship.size, ...shipArtStyle(ship.size) }}>
            <img src={shipSrc(ship.size)} alt="" draggable={false} />
          </span>
        </span>
      ))}
    </div>
  );
}
