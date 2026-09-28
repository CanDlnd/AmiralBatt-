import { MuteButton } from './components/Button';
import { OceanBackground } from './components/OceanBackground';
import { BattleScreen } from './screens/BattleScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { PlacementScreen } from './screens/PlacementScreen';
import { AbandonedScreen, ConnectionScreen } from './screens/StatusScreens';
import { useGame } from './socket/GameProvider';

export default function App() {
  const { link, offline, room } = useGame();

  let screen;
  if (link !== 'online' && !room) {
    screen = <ConnectionScreen mode={offline ? 'offline' : 'connecting'} />;
  } else if (!room) {
    screen = <HomeScreen />;
  } else if (room.status === 'lobby') {
    screen = <LobbyScreen />;
  } else if (room.status === 'placing') {
    screen = <PlacementScreen />;
  } else if (room.status === 'abandoned') {
    screen = <AbandonedScreen />;
  } else {
    screen = <BattleScreen />;
  }

  const scene = room && (room.status === 'placing' || room.status === 'battle' || room.status === 'finished')
    ? 'game'
    : 'menu';

  return (
    <div className="app">
      <OceanBackground scene={scene} />
      <MuteButton />
      <main className="app-frame">{screen}</main>
      {offline && room && link !== 'online' ? <ConnectionScreen mode="offline" overlay /> : null}
    </div>
  );
}
