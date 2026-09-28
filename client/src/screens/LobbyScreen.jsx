import { Check, Copy, Crown, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { useGame } from '../socket/GameProvider';

function hue(name) {
  let hash = 0;
  for (const char of name || '?') hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function PlayerRow({ player, self }) {
  const letter = (player.name || '?').trim().charAt(0).toLocaleUpperCase('tr-TR');
  return (
    <article className={`player ${player.ready ? 'is-ready' : ''}`}>
      <span className="avatar" style={{ background: `hsl(${hue(player.name)} 72% 42%)` }}>
        {letter}
      </span>
      <div className="player-meta">
        <strong>
          {player.name}
          {self ? ' (Sen)' : ''}
        </strong>
        {player.isHost ? (
          <span className="host">
            <Crown size={14} /> Kurucu
          </span>
        ) : null}
      </div>
      <span className={`ready-flag ${player.ready ? 'on' : ''}`}>
        <i />
        {player.ready ? 'Hazır' : 'Bekliyor'}
      </span>
    </article>
  );
}

export function LobbyScreen() {
  const { room, error, setReady, setScenario, startGame, leave } = useGame();
  const [copied, setCopied] = useState(false);
  const opponentReady = Boolean(room.opponent?.ready && room.opponent.connected);
  const canStart = room.you.isHost && opponentReady && room.you.ready;

  let hint = 'Arkadaşına bu kodu göndererek oyuna katılmasını sağla.';
  if (!room.opponent) hint = 'İkinci oyuncu bekleniyor.';
  else if (!room.you.ready || !room.opponent.ready) hint = 'Her iki oyuncu da hazır olunca oyun başlar.';
  else if (room.you.isHost) hint = 'İkiniz de hazırsınız. Oyunu başlatabilirsin.';
  else hint = 'Kurucu oyunu başlatınca gemi dizimine geçilecek.';

  return (
    <section className="lobby screen">
      <header className="screen-title lobby-head">
        <p>LOBİ</p>
        <h2>Oda</h2>
        <Button variant="ghost" icon={LogOut} onClick={leave}>
          LOBİDEN AYRIL
        </Button>
      </header>

      <div className="code-card glass">
        <div className="code-row">
          <strong>{room.code}</strong>
          <button
            type="button"
            className="icon-btn"
            aria-label="Kodu kopyala"
            onClick={async () => {
              const ok = await copyText(room.code);
              if (!ok) return;
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
        </div>
        <p>{copied ? 'Kod kopyalandı.' : 'Arkadaşına bu kodu göndererek oyuna katılmasını sağla.'}</p>
      </div>

      <div className="scenario-row">
        {(room.scenarios || []).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`scenario ${room.scenario?.id === item.id ? 'on' : ''}`}
            disabled={!room.you.isHost || room.scenario?.id === item.id}
            onClick={() => setScenario(item.id)}
          >
            <strong>{item.name}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>

      <div className="player-list">
        <PlayerRow player={room.you} self />
        {room.opponent ? (
          <PlayerRow player={room.opponent} />
        ) : (
          <article className="player empty">
            <span className="avatar ghost">?</span>
            <div className="player-meta">
              <strong>Oyuncu bekleniyor</strong>
            </div>
            <span className="ready-flag">
              <i />
              Bekliyor
            </span>
          </article>
        )}
      </div>

      <p className="hint">{hint}</p>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="stack">
        <Button variant={room.you.ready ? 'ghost' : 'green'} onClick={() => setReady(!room.you.ready)}>
          {room.you.ready ? 'HAZIRLIĞI İPTAL' : 'HAZIRIM'}
        </Button>
        {room.you.isHost ? (
          <Button disabled={!canStart} onClick={startGame}>
            OYUNA BAŞLA
          </Button>
        ) : null}
      </div>
    </section>
  );
}
