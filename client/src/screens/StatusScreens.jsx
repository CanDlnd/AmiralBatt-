import { WifiOff } from 'lucide-react';
import { Button } from '../components/Button';
import { useGame } from '../socket/GameProvider';

export function ConnectionScreen({ mode = 'connecting', overlay = false }) {
  const { retry } = useGame();
  const offline = mode === 'offline';
  return (
    <section className={overlay ? 'overlay' : 'status-screen screen'}>
      <div className="result-card glass">
        <WifiOff size={42} />
        <h2>{offline ? 'Bağlantı kesildi.' : 'Bağlanıyor...'}</h2>
        <p>{offline ? 'Sunucuya yeniden bağlanmayı dene.' : 'Denize açılıyoruz.'}</p>
        {offline ? (
          <Button onClick={retry}>TEKRAR DENE</Button>
        ) : (
          <div className="spinner" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

export function AbandonedScreen() {
  const { room, leave } = useGame();
  const mine = room.abandonedBy && room.abandonedBy === room.you?.id;
  return (
    <section className="status-screen screen">
      <div className="result-card glass lose">
        <WifiOff size={42} />
        <h2>{mine ? 'Bağlantın koptu.' : 'Rakip oyundan ayrıldı.'}</h2>
        <p>{mine ? 'Oyun sonlandı.' : 'Rakip ayrıldığı için bu maç bitti.'}</p>
        <Button onClick={leave}>ANA MENÜ</Button>
      </div>
    </section>
  );
}
