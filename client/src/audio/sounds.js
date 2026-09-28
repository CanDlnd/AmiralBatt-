const SHOT_SRC = '/audio/shot.mp3';
const SHOT_GAIN = 0.07;

let ctx = null;
let muted = false;
let shotBuffer = null;
let shotLoading = null;
let shotSource = null;
let shotGain = null;

function loadShot() {
  if (shotBuffer) return Promise.resolve(shotBuffer);
  if (shotLoading) return shotLoading;
  const context = audio();
  shotLoading = fetch(SHOT_SRC)
    .then((response) => response.arrayBuffer())
    .then((raw) => context.decodeAudioData(raw))
    .then((buffer) => {
      shotBuffer = buffer;
      return buffer;
    })
    .catch((error) => {
      shotLoading = null;
      throw error;
    });
  return shotLoading;
}

function stopShot() {
  if (!shotSource || !shotGain || !ctx) return;
  const now = ctx.currentTime;
  const source = shotSource;
  const gain = shotGain;
  shotSource = null;
  shotGain = null;
  try {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    source.stop(now + 0.04);
  } catch {
    /* Kaynak zaten bitmiş olabilir. */
  }
}

function playShot() {
  const context = audio();
  loadShot().then((buffer) => {
    if (muted || !buffer) return;
    stopShot();
    const source = context.createBufferSource();
    const lowCut = context.createBiquadFilter();
    const highCut = context.createBiquadFilter();
    const gain = context.createGain();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 140;
    lowCut.Q.value = 0.5;
    highCut.type = 'lowpass';
    highCut.frequency.value = 3200;
    highCut.Q.value = 0.45;
    source.buffer = buffer;
    source.connect(lowCut);
    lowCut.connect(highCut);
    highCut.connect(gain);
    gain.connect(context.destination);
    const now = context.currentTime;
    const end = now + buffer.duration;
    const body = Math.max(now + 0.08, end - 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(SHOT_GAIN, now + 0.045);
    gain.gain.setValueAtTime(SHOT_GAIN, body);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    source.start(now);
    shotSource = source;
    shotGain = gain;
    source.onended = () => {
      if (shotSource === source) {
        shotSource = null;
        shotGain = null;
      }
    };
  }).catch(() => {});
}

function audio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, duration, type = 'sine', gain = 0.07, delay = 0) {
  const context = audio();
  const osc = context.createOscillator();
  const amp = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, context.currentTime + delay);
  amp.gain.setValueAtTime(gain, context.currentTime + delay);
  amp.gain.exponentialRampToValueAtTime(0.001, context.currentTime + delay + duration);
  osc.connect(amp);
  amp.connect(context.destination);
  osc.start(context.currentTime + delay);
  osc.stop(context.currentTime + delay + duration + 0.02);
}

const synth = {
  click() {
    tone(680, 0.05, 'triangle', 0.04);
  },
  miss() {
    tone(620, 0.09, 'sine', 0.05);
    tone(380, 0.12, 'sine', 0.03, 0.05);
  },
  hit() {
    tone(150, 0.16, 'sawtooth', 0.05);
    tone(240, 0.1, 'square', 0.03, 0.02);
  },
  sunk() {
    tone(480, 0.1, 'triangle', 0.06, 0);
    tone(320, 0.14, 'triangle', 0.06, 0.1);
    tone(180, 0.22, 'sawtooth', 0.05, 0.2);
  },
  victory() {
    [523, 659, 784, 1046].forEach((freq, index) => tone(freq, 0.16, 'triangle', 0.06, index * 0.11));
  },
  defeat() {
    [392, 330, 220].forEach((freq, index) => tone(freq, 0.2, 'sine', 0.05, index * 0.14));
  },
};

export const sfx = {
  get muted() {
    return muted;
  },
  unlock() {
    try {
      audio();
      loadShot().catch(() => {});
    } catch {
      /* Tarayıcı sesi henüz açmamış olabilir. */
    }
  },
  toggle() {
    muted = !muted;
    if (muted) stopShot();
    return muted;
  },
  play(name) {
    if (muted) return;
    if (name === 'shot') {
      playShot();
      return;
    }
    if (!synth[name]) return;
    try {
      synth[name]();
    } catch {
      /* Ses altyapısı hazır; dosya yoksa sentez de sessiz kalabilir. */
    }
  },
};
