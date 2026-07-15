/**
 * Original synthesized sounds via Web Audio — no recorded/copied assets (PRD §12).
 * Palette: key ticks while typing, a door click on READY, the tram bell on
 * depart, and a rail hum + joint clacks while the tram moves. All ≤1s.
 * Created lazily on first user gesture so autoplay policies are respected.
 */

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function ensureContext(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function getNoise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function strike(c: AudioContext, at: number, freq: number, gain: number, duration: number): void {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + duration);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

/** Short filtered-noise burst: the building block for clicks and clacks. */
function noiseBurst(
  c: AudioContext,
  at: number,
  filterType: BiquadFilterType,
  freq: number,
  gain: number,
  duration: number,
): void {
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + duration);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(at);
  src.stop(at + duration + 0.05);
}

/** Double-ding tram bell: fundamental + shimmer partial, struck twice. */
export function ringBell(enabled: boolean): void {
  if (!enabled) return;
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    strike(c, t, 1318.5, 0.4, 0.5);
    strike(c, t, 1975.5, 0.18, 0.35);
    strike(c, t + 0.11, 1318.5, 0.3, 0.55);
    strike(c, t + 0.11, 1975.5, 0.12, 0.4);
  } catch {
    /* audio must never break the game */
  }
}

/** Soft click for countdown beats. */
export function clickTick(enabled: boolean): void {
  if (!enabled) return;
  const c = ensureContext();
  if (!c) return;
  try {
    strike(c, c.currentTime, 660, 0.12, 0.09);
  } catch {
    /* noop */
  }
}

/** Feather-light key tick for a correct keystroke; pitch jitter keeps it organic. */
export function keyTick(enabled: boolean): void {
  if (!enabled) return;
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;
    noiseBurst(c, t, 'highpass', 3200, 0.05, 0.03);
    strike(c, t, 1150 * jitter, 0.03, 0.04);
  } catch {
    /* noop */
  }
}

/** Muted low thud for a wrong keystroke — distinct but not punishing. */
export function errorTick(enabled: boolean): void {
  if (!enabled) return;
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.07);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = c.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(lp).connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  } catch {
    /* noop */
  }
}

/** Soft door-release click when the stop name is complete (READY). */
export function doorClick(enabled: boolean): void {
  if (!enabled) return;
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    noiseBurst(c, t, 'bandpass', 1800, 0.09, 0.05);
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.07);
    const g = c.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  } catch {
    /* noop */
  }
}

/**
 * Tram rolling to the next stop (~0.6s, matches the move animation):
 * band-swept wheel noise + low motor hum + two rail-joint clacks.
 */
export function tramPass(enabled: boolean): void {
  if (!enabled) return;
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime;

    const wheels = c.createBufferSource();
    wheels.buffer = getNoise(c);
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.1;
    band.frequency.setValueAtTime(450, t);
    band.frequency.exponentialRampToValueAtTime(1400, t + 0.25);
    band.frequency.exponentialRampToValueAtTime(380, t + 0.58);
    const wheelsGain = c.createGain();
    wheelsGain.gain.setValueAtTime(0.001, t);
    wheelsGain.gain.exponentialRampToValueAtTime(0.16, t + 0.16);
    wheelsGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    wheels.connect(band).connect(wheelsGain).connect(c.destination);
    wheels.start(t);
    wheels.stop(t + 0.65);

    const motor = c.createOscillator();
    motor.type = 'triangle';
    motor.frequency.setValueAtTime(70, t);
    motor.frequency.linearRampToValueAtTime(96, t + 0.3);
    motor.frequency.linearRampToValueAtTime(64, t + 0.6);
    const motorGain = c.createGain();
    motorGain.gain.setValueAtTime(0.001, t);
    motorGain.gain.exponentialRampToValueAtTime(0.09, t + 0.15);
    motorGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    motor.connect(motorGain).connect(c.destination);
    motor.start(t);
    motor.stop(t + 0.65);

    noiseBurst(c, t + 0.14, 'highpass', 2200, 0.1, 0.035);
    noiseBurst(c, t + 0.36, 'highpass', 2200, 0.08, 0.035);
  } catch {
    /* noop */
  }
}
