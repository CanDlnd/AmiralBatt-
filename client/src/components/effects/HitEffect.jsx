import { useEffect, useRef, useState } from 'react';
import { HIT_FRAMES } from '../../game/art';

const FRAME_AT = [0, 100, 200, 310, 430];
const HIT_MS = 600;
const IMPACT_FRAME = 2;

const prepared = new Map();
let readyFrames = HIT_FRAMES;
const listeners = new Set();

function keyOutBlack(src) {
  if (prepared.has(src)) return prepared.get(src);
  const job = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = pixels.data;
        for (let index = 0; index < data.length; index += 4) {
          const max = Math.max(data[index], data[index + 1], data[index + 2]);
          if (max <= 6) data[index + 3] = 0;
          else if (max < 16) data[index + 3] = Math.round(((max - 6) / 10) * data[index + 3]);
        }
        context.putImageData(pixels, 0, 0);
        canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : src), 'image/png');
      } catch {
        resolve(src);
      }
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });
  prepared.set(src, job);
  return job;
}

if (typeof document !== 'undefined') {
  Promise.all(HIT_FRAMES.map((src) => keyOutBlack(src))).then((urls) => {
    readyFrames = urls;
    listeners.forEach((listener) => listener());
  });
}

export function useHitFrames() {
  const [frames, setFrames] = useState(readyFrames);
  useEffect(() => {
    const listener = () => setFrames(readyFrames);
    listeners.add(listener);
    if (readyFrames !== HIT_FRAMES) setFrames(readyFrames);
    return () => listeners.delete(listener);
  }, []);
  return frames;
}

export function hitFrameReady(frames, index) {
  return Boolean(frames?.[index] && frames[index] !== HIT_FRAMES[index]);
}

export function HitEffect({ playId, frames = HIT_FRAMES, onComplete, onImpact }) {
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState(true);
  const onCompleteRef = useRef(onComplete);
  const onImpactRef = useRef(onImpact);
  onCompleteRef.current = onComplete;
  onImpactRef.current = onImpact;

  useEffect(() => {
    if (!playId) return undefined;

    setIndex(0);
    setLive(true);
    const timers = FRAME_AT.slice(1).map((at, step) => setTimeout(() => {
      const next = step + 1;
      setIndex(next);
      if (next === IMPACT_FRAME) onImpactRef.current?.();
    }, at));
    const done = setTimeout(() => {
      setLive(false);
      onCompleteRef.current?.();
    }, HIT_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [playId]);

  if (!live) return null;

  return (
    <span className="hit-vfx is-live" aria-hidden="true">
      {HIT_FRAMES.map((_, frame) => {
        const candidate = frames[frame] || HIT_FRAMES[frame];
        const usable = frame < 2 || hitFrameReady(frames, frame);
        if (!usable || !candidate) return null;
        return (
          <img
            key={candidate}
            className={`hit-frame hit-frame-${frame + 1}${frame === index ? ' is-on' : ''}`}
            src={candidate}
            alt=""
            draggable={false}
          />
        );
      })}
    </span>
  );
}
