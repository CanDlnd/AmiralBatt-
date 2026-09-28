import { Anchor, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { LOGO } from '../game/art';
import { useGame } from '../socket/GameProvider';

export function HomeScreen() {
  const { createRoom, joinRoom, error, clearError } = useGame();
  const [name, setName] = useState(() => localStorage.getItem('ab_name') || '');
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [pending, setPending] = useState(false);
  const readyName = name.trim();

  function updateName(value) {
    clearError();
    setName(value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 16));
  }

  async function onCreate(event) {
    event?.preventDefault();
    if (!readyName || pending) return;
    setPending(true);
    await createRoom(readyName);
    setPending(false);
  }

  async function onJoin(event) {
    event?.preventDefault();
    if (!readyName || code.length !== 6 || pending) return;
    setPending(true);
    await joinRoom(readyName, code);
    setPending(false);
  }

  return (
    <section className="home screen">
      <div className="hero">
        <div className="pill">ONLINE 1v1</div>
        <img className="logo" src={LOGO} alt="Amiral Battı" />
        <p>Gemilerini diz. Sıranı bekle. Ateş et.</p>
      </div>

      <form className="panel glass" onSubmit={joining ? onJoin : onCreate}>
        <label className="field">
          <span>Oyuncu adın</span>
          <input
            value={name}
            maxLength={16}
            placeholder="Can"
            autoComplete="nickname"
            onChange={(event) => updateName(event.target.value)}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <Button icon={Anchor} disabled={!readyName || pending} onClick={onCreate}>
          OYUN OLUŞTUR
        </Button>
        <Button
          icon={Users}
          variant="ghost"
          disabled={!readyName || pending}
          onClick={() => {
            clearError();
            setJoining((open) => !open);
          }}
        >
          ODAYA KATIL
        </Button>

        {joining ? (
          <div className="join-box">
            <input
              value={code}
              placeholder="X7K9P2"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              aria-label="Oda kodu"
              onChange={(event) => {
                clearError();
                setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              }}
            />
            <Button variant="green" disabled={!readyName || code.length !== 6 || pending} onClick={onJoin}>
              KATIL
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
