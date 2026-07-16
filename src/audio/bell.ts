/**
 * Original Melbourne-tram-inspired Web Audio palette — no recorded assets.
 * Every cue is synthesized from oscillators and filtered noise, stays under a
 * second, and is routed through one compressor so rapid typing cannot clip.
 */

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let master: AudioNode | null = null;

type DebugWindow = Window & { __dingAudioLog?: string[] };

function traceCue(name: string): void {
  if (typeof window === 'undefined') return;
  (window as DebugWindow).__dingAudioLog?.push(name);
}

function output(c: AudioContext): AudioNode {
  if (master) return master;
  const compressor = c.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 14;
  compressor.ratio.value = 7;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;

  const volume = c.createGain();
  volume.gain.value = 0.62;
  compressor.connect(volume).connect(c.destination);
  master = compressor;
  return compressor;
}

function ensureContext(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    output(ctx);
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call directly from the start-button gesture to satisfy autoplay policies. */
export function primeAudio(enabled: boolean): void {
  if (!enabled) return;
  ensureContext();
}

function getNoise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface ToneOptions {
  type?: OscillatorType;
  endFreq?: number;
  attack?: number;
}

function tone(
  c: AudioContext,
  at: number,
  freq: number,
  gain: number,
  duration: number,
  { type = 'sine', endFreq, attack = 0.004 }: ToneOptions = {},
): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + duration);

  const envelope = c.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + Math.min(attack, duration / 2));
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(envelope).connect(output(c));
  osc.start(at);
  osc.stop(at + duration + 0.03);
}

interface NoiseOptions {
  endFreq?: number;
  q?: number;
  attack?: number;
}

/** Filtered noise supplies switch clicks, rail joints, brakes, and door air. */
function noiseBurst(
  c: AudioContext,
  at: number,
  filterType: BiquadFilterType,
  freq: number,
  gain: number,
  duration: number,
  { endFreq, q = 0.8, attack = 0.002 }: NoiseOptions = {},
): void {
  const source = c.createBufferSource();
  source.buffer = getNoise(c);
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, at);
  if (endFreq) filter.frequency.exponentialRampToValueAtTime(endFreq, at + duration);

  const envelope = c.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + Math.min(attack, duration / 2));
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(envelope).connect(output(c));
  source.start(at);
  source.stop(at + duration + 0.03);
}

function metallicBell(c: AudioContext, at: number, gain: number, pitch = 1): void {
  // Slightly inharmonic partials read as a struck mechanical tram bell rather
  // than a clean notification sine wave.
  tone(c, at, 1174.7 * pitch, gain, 0.56);
  tone(c, at, 1768 * pitch, gain * 0.46, 0.42);
  tone(c, at, 2387 * pitch, gain * 0.22, 0.28);
  noiseBurst(c, at, 'highpass', 3400, gain * 0.16, 0.025);
}

/** Relay-like countdown click; pitch rises as the doors get ready to close. */
export function clickTick(enabled: boolean, count = 1): void {
  if (!enabled) return;
  traceCue(`countdown-${count}`);
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const pitch = 520 + Math.max(0, 3 - count) * 105;
    noiseBurst(c, t, 'highpass', 2600, 0.055, 0.025);
    tone(c, t, pitch, 0.075, 0.075, { type: 'triangle' });
  } catch {
    /* audio must never break the game */
  }
}

/** Door-close relay plus a short traction-motor rise when the run begins. */
export function departureCue(enabled: boolean): void {
  if (!enabled) return;
  traceCue('departure');
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    tone(c, t, 659.3, 0.085, 0.12, { type: 'triangle' });
    tone(c, t + 0.095, 880, 0.075, 0.15, { type: 'triangle' });
    noiseBurst(c, t + 0.2, 'bandpass', 1750, 0.07, 0.055, { q: 1.4 });
    tone(c, t + 0.22, 66, 0.06, 0.38, { type: 'triangle', endFreq: 104, attack: 0.05 });
  } catch {
    /* noop */
  }
}

/**
 * Correct-character response: controller click + a traction pulse whose tone
 * follows real typing cadence. Rail joints and overhead-wire ticks add motion
 * without making every key sound identical.
 */
export function keyTick(enabled: boolean, combo = 0, progress = 0, cadenceMs = 240): void {
  if (!enabled) return;
  traceCue('key');
  const pace = cadenceMs <= 105 ? 'fast' : cadenceMs <= 230 ? 'cruise' : 'slow';
  traceCue(`pace-${pace}`);
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const notes = [830.6, 932.3, 1046.5, 1174.7];
    const paceLift = pace === 'fast' ? 105 : pace === 'cruise' ? 48 : 0;
    const note = notes[Math.max(0, combo - 1) % notes.length] + Math.min(1, progress) * 70 + paceLift;
    const clickGain = pace === 'fast' ? 0.022 : pace === 'cruise' ? 0.029 : 0.036;
    noiseBurst(c, t, 'highpass', pace === 'slow' ? 2900 : 3800, clickGain, 0.022);
    tone(c, t, note, pace === 'fast' ? 0.021 : 0.027, 0.052, { type: 'triangle' });
    tone(c, t, 68 + Math.min(1, progress) * 31 + paceLift * 0.08, pace === 'fast' ? 0.018 : 0.014, 0.075, {
      type: 'triangle',
      endFreq: 80 + Math.min(1, progress) * 36 + paceLift * 0.12,
    });

    if (pace === 'slow') {
      // A deliberate key feels like moving the driver's controller one notch.
      tone(c, t + 0.008, 118, 0.02, 0.07, { type: 'square', endFreq: 94 });
    }

    if (combo > 0 && combo % 4 === 0) {
      traceCue('rail-joint');
      noiseBurst(c, t + 0.012, 'bandpass', 1250, 0.052, 0.035, { q: 1.8 });
      tone(c, t + 0.012, 190, 0.022, 0.05, { type: 'triangle', endFreq: 145 });
      if (combo % 8 === 0) {
        traceCue('bogie-clack');
        noiseBurst(c, t + 0.055, 'bandpass', 1080, 0.039, 0.032, { q: 1.6 });
      }
    }
    if (combo > 0 && combo % 12 === 0) {
      traceCue('wire-tick');
      noiseBurst(c, t + 0.025, 'highpass', 5200, 0.027, 0.018, { q: 2.2 });
      tone(c, t + 0.025, 2650, 0.014, 0.045, { type: 'sine', endFreq: 3100 });
    }
    if (combo > 0 && combo % 10 === 0) {
      traceCue(`combo-${combo}`);
      tone(c, t + 0.045, 1318.5, 0.04, 0.13);
      tone(c, t + 0.115, 1760, 0.035, 0.16);
    }
  } catch {
    /* noop */
  }
}

/** Short wheel-flange and brake cue as the tram approaches the next platform. */
export function approachCue(enabled: boolean, stationOrdinal = 0): void {
  if (!enabled) return;
  traceCue('station-approach');
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const variation = stationOrdinal % 3;
    const bend = variation === 0 ? 1 : variation === 1 ? 0.94 : 1.06;
    tone(c, t, 1180 * bend, 0.018, 0.2, { type: 'sine', endFreq: 790 * bend, attack: 0.025 });
    tone(c, t + 0.015, 1510 * bend, 0.011, 0.17, { type: 'sine', endFreq: 1010 * bend, attack: 0.02 });
    noiseBurst(c, t + 0.035, 'bandpass', 1350, 0.028, 0.18, {
      endFreq: 540,
      q: 1.2,
      attack: 0.02,
    });
  } catch {
    /* noop */
  }
}

/** Brake-controller clunk for a miss — audible, short, and not punishing. */
export function errorTick(enabled: boolean): void {
  if (!enabled) return;
  traceCue('error');
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    noiseBurst(c, t, 'lowpass', 720, 0.075, 0.075, { endFreq: 320, q: 1.3 });
    tone(c, t, 155, 0.065, 0.11, { type: 'square', endFreq: 105 });
  } catch {
    /* noop */
  }
}

/**
 * Station response: rail-brake wash, Melbourne-style double bell, then a soft
 * pneumatic door release. The final stop adds a short resolving third strike.
 */
export function stopArrivalCue(enabled: boolean, finalStop = false, stationOrdinal = 0): void {
  if (!enabled) return;
  traceCue(finalStop ? 'route-complete' : 'stop-arrival');
  const variation = stationOrdinal % 3;
  traceCue(`arrival-variant-${variation}`);
  const c = ensureContext();
  if (!c) return;
  try {
    // Let the final character click land before the larger station response.
    const t = c.currentTime + 0.055;
    const pitch = variation === 0 ? 1 : variation === 1 ? 0.975 : 1.025;
    noiseBurst(c, t, 'bandpass', 1500, 0.055, 0.32, {
      endFreq: 420,
      q: 1.1,
      attack: 0.025,
    });
    tone(c, t, 96, 0.045, 0.28, { type: 'triangle', endFreq: 61, attack: 0.025 });
    metallicBell(c, t + 0.055, 0.24, pitch);
    metallicBell(c, t + (variation === 1 ? 0.23 : 0.2), 0.19, pitch * 0.996);

    noiseBurst(c, t + 0.37, 'bandpass', 1900, 0.06, 0.055, { q: 1.5 });
    noiseBurst(c, t + 0.42, 'highpass', 2300, 0.04, 0.24, { endFreq: 4100, attack: 0.018 });
    tone(c, t + 0.38, 740, 0.04, 0.16, { type: 'triangle', endFreq: 554 });

    if (finalStop) {
      metallicBell(c, t + 0.48, 0.16, pitch);
      tone(c, t + 0.58, 659.3, 0.045, 0.2, { type: 'triangle' });
      tone(c, t + 0.68, 987.8, 0.04, 0.24, { type: 'triangle' });
    }
  } catch {
    /* noop */
  }
}
