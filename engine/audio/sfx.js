// Synthesized sound effects. Each effect adds voices to a stereo Synth lane;
// `p.amp` already includes the per-effect trim, the cue gain and sfxVolume.
import { Voice, Env, WAVES } from './synth.js';
import { mtof, dbToGain } from './dsp.js';
import { pentaNote } from './theory.js';
import { makeRng, hashSeed } from './rng.js';

const perc = (t, peak, attack, tau) => new Env(0).set(0, t).lin(peak, t + attack).target(0, t + attack, tau);
const seedOf = (rng) => Math.floor(rng.next() * 4294967295) || 1;

// Bell-like ping with a few inharmonic partials.
const PING = [[1, 1, 1], [2, 0.35, 0.55], [2.76, 0.2, 0.4], [5.4, 0.08, 0.2]];

function ping(syn, lane, t, midi, peak, decay, { partials = PING, pan = 0 } = {}) {
  const f = mtof(midi);
  const parts = partials.filter(([ratio]) => f * ratio < 16000);
  const v = new Voice(t, t + (decay / 4) * 7 + 0.02);
  for (const [ratio, amp, df] of parts) v.layer({ wave: WAVES.sine, freq: f * ratio, amp: perc(t, peak * amp, 0.0015, (decay * df) / 4) });
  v.pan = pan;
  syn.add(lane, v);
}

function noiseBurst(syn, lane, t, peak, tau, rng, { type = 'highpass', freq = 3000, q = 0.8, pink = false, attack = 0.0008, pan = 0 } = {}) {
  const v = new Voice(t, t + attack + tau * 7 + 0.01);
  v.layer({ wave: pink ? WAVES.pink : WAVES.noise, seed: seedOf(rng), amp: perc(t, peak, attack, tau) });
  v.filter = { type, freq, q };
  v.pan = pan;
  syn.add(lane, v);
}

function tone(syn, lane, t, wave, freq, peak, attack, tau, { freqEnv = null, pan = 0, length } = {}) {
  const v = new Voice(t, t + (length ?? attack + tau * 7 + 0.01));
  v.layer({ wave, freq, freqEnv, amp: perc(t, peak, attack, tau) });
  v.pan = pan;
  syn.add(lane, v);
}

// Felt-marker / chalk strokes: one filtered noise voice whose gain and centre
// frequency are automated stroke by stroke.
function strokes(syn, lane, t, p, { dur, band, q, pink, grain, squeak }) {
  const rng = p.rng;
  const amp = new Env(0).set(0, t);
  const freq = new Env(band[0]).set(band[0], t);
  const end = t + dur;
  const squeaks = [];
  let s = t;
  while (s < end - 0.04) {
    const len = Math.min(end - s, rng.range(0.09, 0.22));
    const peak = p.amp * rng.range(0.7, 1);
    const f0 = rng.range(band[0], band[1]);
    freq.set(f0, s).lin(f0 * rng.range(0.8, 1.25), s + len);
    amp.set(0, s).lin(peak, s + 0.018);
    if (grain) {
      for (let x = s + 0.03; x < s + len - 0.03; x += rng.range(0.012, 0.025)) amp.lin(peak * rng.range(0.35, 1), x);
    } else {
      amp.lin(peak * rng.range(0.75, 0.95), s + len - 0.022);
    }
    amp.lin(0, s + len);
    if (squeak && rng.chance(0.25)) squeaks.push([s + rng.range(0.02, Math.max(0.03, len - 0.08)), rng.range(2600, 3400)]);
    s += len + rng.range(0.02, 0.05);
  }
  const v = new Voice(t, end + 0.05);
  v.layer({ wave: pink ? WAVES.pink : WAVES.noise, seed: seedOf(rng), amp });
  v.filter = { type: 'bandpass', q, freqEnv: freq };
  v.pan = rng.range(-0.15, 0.15);
  syn.add(lane, v);
  for (const [at, f] of squeaks) {
    const sv = new Voice(at, at + 0.2);
    sv.layer({ wave: WAVES.sine, freqEnv: new Env(f).set(f, at).lin(f * rng.range(0.9, 1.1), at + 0.06), amp: perc(at, p.amp * 0.18, 0.01, 0.025) });
    syn.add(lane, sv);
  }
}

// Filtered-noise sweep panned across the stereo field.
function sweep(syn, lane, t, p, { dur, from, to, back, q, panFrom, panTo, peakAt = 0.55 }) {
  const v = new Voice(t, t + dur * 1.6 + 0.05);
  v.layer({
    wave: WAVES.pink,
    seed: seedOf(p.rng),
    amp: new Env(0).set(0.0001, t).exp(p.amp, t + dur * peakAt).target(0, t + dur * peakAt, dur * 0.18),
  });
  v.filter = { type: 'bandpass', q, freqEnv: new Env(from).set(from, t).exp(to, t + dur * 0.7).exp(back, t + dur) };
  v.panEnv = new Env(panFrom).set(panFrom, t).lin(panTo, t + dur);
  syn.add(lane, v);
}

// name -> { description, trimDb, dur (default), play(syn, lane, t, p) }
// trimDb calibrates each effect's peak at gain 1: short effects about -18 dBFS,
// textures (whoosh, scribble, chalk, type) a few dB lower, i.e. roughly
// 11 dB under Kokoro narration peaks.
export const SFX_DEFS = {
  pop: {
    description: 'Short round pop for things appearing (boxes, icons, labels).',
    trimDb: -20.1,
    play(syn, lane, t, p) {
      const f0 = p.rng.range(360, 420);
      tone(syn, lane, t, WAVES.sine, 0, p.amp, 0.002, 0.03, { freqEnv: new Env(f0).set(f0, t).exp(p.rng.range(780, 880), t + 0.045), length: 0.3 });
      noiseBurst(syn, lane, t, p.amp * 0.25, 0.004, p.rng, { freq: 2500 });
    },
  },
  click: {
    description: 'Tiny UI click (buttons, toggles, cursor clicks).',
    trimDb: -19.6,
    play(syn, lane, t, p) {
      noiseBurst(syn, lane, t, p.amp, 0.003, p.rng, { type: 'bandpass', freq: 3500, q: 1 });
      tone(syn, lane, t, WAVES.sine, 1800, p.amp * 0.5, 0.0005, 0.004);
    },
  },
  whoosh: {
    description: 'Airy whoosh for movement, arrows and slides (dur, default 0.45 s).',
    trimDb: -12.9,
    dur: 0.45,
    play(syn, lane, t, p) {
      sweep(syn, lane, t, p, { dur: p.dur, from: 350, to: 2600, back: 1300, q: 1.1, panFrom: -0.55, panTo: 0.55 });
    },
  },
  swipe: {
    description: 'Wider, deeper whoosh for scene transitions (dur, default 0.6 s).',
    trimDb: -16.1,
    dur: 0.6,
    play(syn, lane, t, p) {
      sweep(syn, lane, t, p, { dur: p.dur, from: 200, to: 4200, back: 1500, q: 0.8, panFrom: -0.8, panTo: 0.8 });
      const v = new Voice(t, t + p.dur * 1.6);
      v.layer({
        wave: WAVES.sine,
        freqEnv: new Env(90).set(90, t).exp(55, t + p.dur),
        amp: new Env(0).set(0.0001, t).exp(p.amp * 0.35, t + p.dur * 0.5).target(0, t + p.dur * 0.5, p.dur * 0.2),
      });
      syn.add(lane, v);
    },
  },
  tick: {
    description: 'Single crisp tick (count-ups, typing, clock hands).',
    trimDb: -21.1,
    play(syn, lane, t, p) {
      noiseBurst(syn, lane, t, p.amp * 0.7, 0.0018, p.rng, { freq: 3500 });
      tone(syn, lane, t, WAVES.sine, 2800 * p.rng.range(0.94, 1.06), p.amp * 0.5, 0.0005, 0.005);
    },
  },
  type: {
    description: 'Keyboard typing burst (dur, default 0.8 s).',
    trimDb: -20.5,
    dur: 0.8,
    play(syn, lane, t, p) {
      const rng = p.rng;
      let k = t;
      let n = 0;
      while (k < t + p.dur) {
        const space = n > 0 && n % 6 === 5;
        const v = p.amp * rng.range(0.6, 1);
        const pan = rng.range(-0.2, 0.2);
        noiseBurst(syn, lane, k, v, 0.006, rng, { type: 'bandpass', freq: space ? 1800 : rng.range(2300, 3900), q: 1.4, pan });
        tone(syn, lane, k, WAVES.sine, space ? 140 : rng.range(170, 215), v * 0.45, 0.001, 0.012, { pan });
        k += rng.range(0.045, 0.11);
        n++;
      }
    },
  },
  ding: {
    description: 'Clear bell ding on the tonic (a highlight or a correct answer).',
    trimDb: -21,
    play(syn, lane, t, p) {
      ping(syn, lane, t, p.tonic + 24, p.amp, 1.4);
    },
  },
  chime: {
    description: 'Two-note rising chime (success, done, reveal).',
    trimDb: -24.4,
    play(syn, lane, t, p) {
      ping(syn, lane, t, p.tonic + 19, p.amp * 0.85, 1.2, { pan: -0.15 });
      ping(syn, lane, t + 0.11, p.tonic + 24, p.amp, 1.6, { pan: 0.15 });
    },
  },
  thud: {
    description: 'Soft low thud (something lands, a heavy point).',
    trimDb: -17,
    play(syn, lane, t, p) {
      tone(syn, lane, t, WAVES.sine, 0, p.amp, 0.002, 0.09, { freqEnv: new Env(110).set(110, t).exp(42, t + 0.18), length: 0.7 });
      noiseBurst(syn, lane, t, p.amp * 0.3, 0.03, p.rng, { type: 'lowpass', freq: 400 });
    },
  },
  heartbeat: {
    description: 'A heartbeat, lub-dub (dread, a scare coming, a held breath).',
    trimDb: -15,
    play(syn, lane, t, p) {
      [[0, 1, 76, 0.3], [0.27, 0.65, 64, 0.34]].forEach(([dt, k, f]) => {
        tone(syn, lane, t + dt, WAVES.sine, 0, p.amp * k, 0.003, 0.075, { freqEnv: new Env(f * 1.8).set(f * 1.8, t + dt).exp(f * 0.6, t + dt + 0.11), length: 0.6 });
        noiseBurst(syn, lane, t + dt, p.amp * 0.18 * k, 0.025, p.rng, { type: 'lowpass', freq: 300 });
      });
    },
  },
  sting: {
    description: 'Horror sting: a violin screech that falls, with a low slam under it (a jump scare, a reveal).',
    trimDb: -24,
    play(syn, lane, t, p) {
      // a cluster of saws a semitone and a tritone apart, sliding down together
      const v = new Voice(t, t + 1.5);
      for (const [semi, k] of [[0, 1], [1, 0.8], [6, 0.7], [13, 0.5]]) {
        const f = mtof(p.tonic + 36 + semi);
        v.layer({ wave: WAVES.saw, detune: semi % 2 ? 14 : -9, freqEnv: new Env(f * 1.04).set(f * 1.04, t).exp(f * 0.86, t + 1.1), amp: new Env(0).set(0, t).lin(p.amp * 0.5 * k, t + 0.03).target(0, t + 0.03, 0.28) });
      }
      v.filter = { type: 'lowpass', q: 1.1, freqEnv: new Env(5200).set(5200, t).exp(1400, t + 0.9) };
      syn.add(lane, v);
      tone(syn, lane, t, WAVES.sine, 0, p.amp * 1.4, 0.003, 0.12, { freqEnv: new Env(95).set(95, t).exp(38, t + 0.25), length: 0.9 });
      noiseBurst(syn, lane, t, p.amp * 0.5, 0.06, p.rng, { type: 'lowpass', freq: 900 });
    },
  },
  creak: {
    description: 'A door or a floorboard creaking slowly (dur, default 1.4 s): something is moving that should not be.',
    trimDb: -12,
    dur: 1.4,
    play(syn, lane, t, p) {
      const rng = p.rng;
      const end = t + p.dur;
      const f = new Env(180).set(180, t);
      const a = new Env(0).set(0, t);
      let at = t;
      let pitch = rng.range(150, 230);
      // a stick-slip motion: the pitch wanders up in small jerks and the sound stutters
      while (at < end - 0.05) {
        const len = rng.range(0.05, 0.14);
        pitch = Math.min(520, pitch * rng.range(0.96, 1.12));
        f.lin(pitch, at + len);
        a.lin(p.amp * rng.range(0.35, 1) * Math.sin((Math.PI * (at - t)) / p.dur), at + len * 0.5).lin(p.amp * 0.12, at + len);
        at += len;
      }
      a.lin(0, end);
      const v = new Voice(t, end + 0.1);
      v.layer({ wave: WAVES.saw, freqEnv: f, amp: a });
      v.layer({ wave: WAVES.tri, detune: 35, freqEnv: f, amp: a });
      v.filter = { type: 'bandpass', q: 5, freqEnv: new Env(700).set(700, t).exp(1500, end) };
      syn.add(lane, v);
    },
  },
  whisper: {
    description: 'A breathy whisper in the next room (dur, default 1.6 s): words that are almost heard.',
    trimDb: -15,
    dur: 1.6,
    play(syn, lane, t, p) {
      const rng = p.rng;
      const end = t + p.dur;
      const a = new Env(0).set(0, t);
      const f = new Env(1700).set(1700, t);
      let at = t;
      // syllables: short breaths whose band moves, like words with the voice taken out
      while (at < end - 0.08) {
        const len = rng.range(0.1, 0.22);
        a.lin(p.amp * rng.range(0.4, 1), at + len * 0.35).lin(p.amp * 0.08, at + len);
        f.lin(rng.range(1100, 3200), at + len * 0.6);
        at += len + rng.range(0.02, 0.07);
      }
      a.lin(0, end);
      const v = new Voice(t, end + 0.1);
      v.layer({ wave: WAVES.pink, seed: seedOf(rng), amp: a });
      v.filter = { type: 'bandpass', q: 2.4, freqEnv: f };
      v.pan = rng.range(-0.6, 0.6);
      syn.add(lane, v);
    },
  },
  knock: {
    description: 'Knocking on a wooden door (pitch = number of knocks, default 3; dur = time they take, default 0.9 s, so about 0.3 s apart): someone is outside.',
    trimDb: -15,
    dur: 0.9,
    play(syn, lane, t, p) {
      const n = Math.max(1, Math.min(8, Math.round(p.pitch ?? 3)));
      const gap = Math.max(0.16, p.dur / n);
      for (let i = 0; i < n; i++) {
        const at = t + i * gap + p.rng.range(-0.015, 0.015);
        const k = p.rng.range(0.8, 1);
        // a knuckle on wood: a low hollow body, a mid wooden ring and a tiny dry tick
        tone(syn, lane, at, WAVES.sine, 0, p.amp * 1.3 * k, 0.001, 0.032, { freqEnv: new Env(190).set(190, at).exp(95, at + 0.09), length: 0.4 });
        ping(syn, lane, at, 55 + p.rng.range(-0.3, 0.3), p.amp * 0.3 * k, 0.1, { partials: [[1, 1, 1], [1.9, 0.5, 0.6], [3.1, 0.25, 0.4]] });
        noiseBurst(syn, lane, at, p.amp * 0.55 * k, 0.012, p.rng, { type: 'bandpass', freq: 1400, q: 1.1 });
      }
    },
  },
  ring: {
    description: 'A phone ringing (dur, default 2 s): two quick trills, a pause, two more.',
    trimDb: -24,
    dur: 2,
    play(syn, lane, t, p) {
      const end = t + p.dur;
      for (let start = t; start < end - 0.1; start += 1) {
        for (const off of [0, 0.4]) {
          const a = start + off;
          if (a >= end - 0.05) continue;
          const v = new Voice(a, Math.min(end, a + 0.34));
          const f = new Env(1318).set(1318, a);
          for (let x = a; x < a + 0.3; x += 0.03) f.set(Math.floor((x - a) / 0.03) % 2 ? 1568 : 1318, x);
          v.layer({ wave: WAVES.square, freqEnv: f, amp: new Env(0).set(0, a).lin(p.amp * 0.5, a + 0.01).lin(p.amp * 0.5, a + 0.27).lin(0, a + 0.31) });
          v.filter = { type: 'lowpass', freq: 3200, q: 0.7 };
          syn.add(lane, v);
        }
      }
    },
  },
  buzz: {
    description: 'A phone buzzing on a table, then a soft notification ping (a message arrives).',
    trimDb: -17,
    play(syn, lane, t, p) {
      for (const dt of [0, 0.34]) {
        const a = t + dt;
        const v = new Voice(a, a + 0.3);
        v.layer({ wave: WAVES.saw, freq: 118, amp: new Env(0).set(0, a).lin(p.amp, a + 0.015).lin(p.amp * 0.8, a + 0.2).lin(0, a + 0.26) });
        v.layer({ wave: WAVES.square, freq: 236, amp: new Env(0).set(0, a).lin(p.amp * 0.3, a + 0.015).lin(0, a + 0.26) });
        v.filter = { type: 'lowpass', freq: 900, q: 1.2 };
        syn.add(lane, v);
        noiseBurst(syn, lane, a + 0.1, p.amp * 0.25, 0.05, p.rng, { type: 'bandpass', freq: 2200, q: 2 });
      }
      ping(syn, lane, t + 0.75, p.tonic + 31, p.amp * 0.35, 0.5, { pan: 0.1 });
    },
  },
  chain: {
    description: 'A door chain and a lock: metal links rattling, then a heavy bolt sliding (someone touches the lock).',
    trimDb: -15,
    play(syn, lane, t, p) {
      const rng = p.rng;
      for (let i = 0; i < 6; i++) {
        const at = t + i * 0.055 + rng.range(0, 0.03);
        ping(syn, lane, at, 90 + rng.range(-5, 9), p.amp * rng.range(0.15, 0.4), 0.12, { partials: [[1, 1, 1], [2.3, 0.6, 0.6], [4.1, 0.3, 0.4]], pan: rng.range(-0.3, 0.3) });
        noiseBurst(syn, lane, at, p.amp * 0.12, 0.01, rng, { type: 'highpass', freq: 5000 });
      }
      // the bolt: a short scrape and a dull metallic clack
      noiseBurst(syn, lane, t + 0.42, p.amp * 0.25, 0.09, rng, { type: 'bandpass', freq: 1800, q: 3 });
      tone(syn, lane, t + 0.55, WAVES.sine, 0, p.amp * 0.9, 0.001, 0.03, { freqEnv: new Env(260).set(260, t + 0.55).exp(120, t + 0.62), length: 0.3 });
      ping(syn, lane, t + 0.55, 68, p.amp * 0.3, 0.14);
    },
  },
  steps: {
    description: 'Footsteps on wooden floorboards (pitch = number of steps, default 4; dur = time they take, default 2 s): slow, soft, one heel at a time.',
    trimDb: -13,
    dur: 2,
    play(syn, lane, t, p) {
      const n = Math.max(1, Math.min(10, Math.round(p.pitch ?? 4)));
      const gap = p.dur / n;
      for (let i = 0; i < n; i++) {
        const at = t + i * gap + p.rng.range(-0.04, 0.04);
        const side = i % 2 ? 0.25 : -0.25;
        tone(syn, lane, at, WAVES.sine, 0, p.amp * p.rng.range(0.8, 1), 0.004, 0.05, { freqEnv: new Env(95).set(95, at).exp(55, at + 0.14), pan: side, length: 0.4 });
        noiseBurst(syn, lane, at, p.amp * 0.35, 0.025, p.rng, { type: 'lowpass', freq: 700, pan: side });
        // a board answers with a faint creak
        if (p.rng.chance(0.4)) tone(syn, lane, at + 0.05, WAVES.saw, 0, p.amp * 0.08, 0.02, 0.1, { freqEnv: new Env(260).set(260, at + 0.05).exp(340, at + 0.2), pan: side, length: 0.35 });
      }
    },
  },
  callend: {
    description: 'A call ending: three short falling beeps, then the line goes dead (a phone call disconnects).',
    trimDb: -22,
    play(syn, lane, t, p) {
      [[0, 700], [0.22, 560], [0.44, 440]].forEach(([dt, f]) => {
        const a = t + dt;
        tone(syn, lane, a, WAVES.sine, f, p.amp, 0.004, 0.06, { length: 0.2 });
      });
      noiseBurst(syn, lane, t + 0.72, p.amp * 0.12, 0.2, p.rng, { type: 'lowpass', freq: 1800 });
    },
  },
  scribble: {
    description: 'Felt marker on paper while something is drawn (dur, default 0.6 s).',
    trimDb: -15.9,
    dur: 0.6,
    play(syn, lane, t, p) {
      strokes(syn, lane, t, p, { dur: p.dur, band: [1500, 2700], q: 1.3, pink: true, grain: false, squeak: false });
    },
  },
  chalk: {
    description: 'Chalk on a blackboard while something is drawn (dur, default 0.6 s).',
    trimDb: -22.3,
    dur: 0.6,
    play(syn, lane, t, p) {
      strokes(syn, lane, t, p, { dur: p.dur, band: [2800, 4800], q: 0.9, pink: false, grain: true, squeak: true });
    },
  },
  rise: {
    description: 'Riser that builds from t and ends at t + dur (default 1 s) for a big reveal.',
    trimDb: -18.3,
    dur: 1,
    play(syn, lane, t, p) {
      const end = t + p.dur;
      const nv = new Voice(t, end + 0.05);
      nv.layer({ wave: WAVES.pink, seed: seedOf(p.rng), amp: new Env(0).set(0.0001, t).exp(p.amp, end).lin(0, end + 0.03) });
      nv.filter = { type: 'bandpass', q: 1.6, freqEnv: new Env(300).set(300, t).exp(7000, end) };
      syn.add(lane, nv);
      const sv = new Voice(t, end + 0.05);
      for (const d of [-9, 9]) {
        sv.layer({
          wave: WAVES.saw,
          detune: d,
          freqEnv: new Env(mtof(p.tonic - 12)).set(mtof(p.tonic - 12), t).exp(mtof(p.tonic + 12), end),
          amp: new Env(0).set(0.0001, t).exp(p.amp * 0.3, end).lin(0, end + 0.03),
        });
      }
      sv.filter = { type: 'lowpass', q: 1.4, freqEnv: new Env(400).set(400, t).exp(6000, end) };
      syn.add(lane, sv);
    },
  },
  sparkle: {
    description: 'Cluster of high bell pings (magic, delight, something new).',
    trimDb: -26.3,
    play(syn, lane, t, p) {
      const rng = p.rng;
      let at = t;
      for (let k = 0; k < 6; k++) {
        ping(syn, lane, at, pentaNote(p.tonic + 24, rng.int(0, 6)), p.amp * Math.pow(0.85, k), rng.range(0.5, 0.8), {
          partials: [[1, 1, 1], [2.76, 0.2, 0.4], [5.4, 0.1, 0.2]],
          pan: rng.range(-0.7, 0.7),
        });
        at += rng.range(0.035, 0.07);
      }
    },
  },
  blip: {
    description: "Short pitched blip; pitch = step in the key's pentatonic scale, so list items can ascend.",
    trimDb: -19.4,
    play(syn, lane, t, p) {
      const f = mtof(pentaNote(p.tonic + 12, Math.round(p.pitch || 0)));
      const v = new Voice(t, t + 0.4);
      v.layer({ wave: WAVES.tri, freqEnv: new Env(f * 0.94).set(f * 0.94, t).exp(f, t + 0.015), amp: perc(t, p.amp, 0.002, 0.05) });
      v.layer({ wave: WAVES.sine, freq: f * 2, amp: perc(t, p.amp * 0.25, 0.002, 0.025) });
      syn.add(lane, v);
    },
  },
  error: {
    description: 'Soft low double buzz (wrong, blocked, failure).',
    trimDb: -23.9,
    play(syn, lane, t, p) {
      const v = new Voice(t, t + 0.35);
      for (const f of [110, 116.5]) {
        const amp = new Env(0).set(0, t);
        for (const s of [t, t + 0.17]) amp.set(0, s).lin(p.amp, s + 0.01).set(p.amp, s + 0.1).lin(0, s + 0.12);
        v.layer({ wave: WAVES.saw, freq: f, amp });
      }
      v.filter = { type: 'lowpass', freq: 700, q: 0.8 };
      syn.add(lane, v);
    },
  },
  // ---- old television (explainer-duo's 90s TV treatment) ----
  static: {
    description: 'TV static: a hiss burst that stutters and fades (dur, default 0.5 s).',
    trimDb: -17,
    dur: 0.5,
    play(syn, lane, t, p) {
      const rng = p.rng;
      const end = t + p.dur;
      const a = new Env(0).set(0, t);
      let at = t;
      while (at < end - 0.03) {
        const len = rng.range(0.025, 0.08);
        const k = 1 - (at - t) / p.dur;
        a.lin(p.amp * rng.range(0.5, 1) * (0.35 + 0.65 * k), at + 0.004).lin(p.amp * 0.12 * k, at + len);
        at += len;
      }
      a.lin(0, end);
      const v = new Voice(t, end + 0.05);
      v.layer({ wave: WAVES.noise, seed: seedOf(rng), amp: a });
      v.filter = { type: 'highpass', freq: 1200, q: 0.7 };
      syn.add(lane, v);
    },
  },
  channel: {
    description: 'Changing the channel on an old TV: a relay click, a burst of static and a short beep.',
    trimDb: -16,
    dur: 0.5,
    play(syn, lane, t, p) {
      noiseBurst(syn, lane, t, p.amp * 0.8, 0.004, p.rng, { type: 'lowpass', freq: 500 });
      tone(syn, lane, t, WAVES.sine, 90, p.amp * 0.6, 0.001, 0.03);
      SFX_DEFS.static.play(syn, lane, t + 0.02, { ...p, dur: 0.3, amp: p.amp * 0.9 });
      tone(syn, lane, t + 0.32, WAVES.sine, 1000, p.amp * 0.2, 0.003, 0.05);
    },
  },
  crton: {
    description: 'A CRT television switching on: a thump, a rising electrical whine and a flash of static.',
    trimDb: -17,
    dur: 0.9,
    play(syn, lane, t, p) {
      tone(syn, lane, t, WAVES.sine, 0, p.amp * 0.9, 0.004, 0.09, { freqEnv: new Env(120).set(120, t).exp(45, t + 0.18), length: 0.5 });
      noiseBurst(syn, lane, t, p.amp * 0.5, 0.05, p.rng, { type: 'lowpass', freq: 700 });
      const v = new Voice(t, t + p.dur);
      v.layer({
        wave: WAVES.sine,
        freqEnv: new Env(900).set(900, t).exp(7000, t + 0.35).lin(7500, t + p.dur),
        amp: new Env(0).set(0, t).lin(p.amp * 0.12, t + 0.1).lin(p.amp * 0.05, t + 0.5).lin(0, t + p.dur),
      });
      syn.add(lane, v);
      SFX_DEFS.static.play(syn, lane, t + 0.05, { ...p, dur: 0.35, amp: p.amp * 0.6 });
    },
  },
  vhs: {
    description: 'VHS tracking glitch: a warbling tape squeal under a band of static (dur, default 0.5 s).',
    trimDb: -18,
    dur: 0.5,
    play(syn, lane, t, p) {
      const rng = p.rng;
      const end = t + p.dur;
      const f = new Env(420).set(420, t);
      let at = t;
      while (at < end) { at += rng.range(0.04, 0.1); f.lin(rng.range(200, 900), at); }
      const v = new Voice(t, end + 0.05);
      v.layer({ wave: WAVES.saw, freqEnv: f, amp: new Env(0).set(0, t).lin(p.amp * 0.3, t + 0.04).lin(p.amp * 0.18, end - 0.08).lin(0, end) });
      v.filter = { type: 'lowpass', freq: 2800, q: 0.9 };
      v.pan = rng.range(-0.3, 0.3);
      syn.add(lane, v);
      SFX_DEFS.static.play(syn, lane, t, { ...p, dur: p.dur, amp: p.amp * 0.5 });
    },
  },
  hiss: {
    description: 'Quiet old-television hiss with a faint mains hum, for a whole section (dur, default 10 s). Very low: use it under narration.',
    trimDb: -30,
    dur: 10,
    play(syn, lane, t, p) {
      const end = t + p.dur;
      const v = new Voice(t, end + 0.1);
      v.layer({ wave: WAVES.pink, seed: seedOf(p.rng), amp: new Env(0).set(0, t).lin(p.amp, t + 0.2).lin(p.amp, end - 0.2).lin(0, end) });
      v.filter = { type: 'highpass', freq: 1400, q: 0.5 };
      syn.add(lane, v);
      const h = new Voice(t, end + 0.1);
      h.layer({ wave: WAVES.sine, freq: 60, amp: new Env(0).set(0, t).lin(p.amp * 0.25, t + 0.2).lin(p.amp * 0.25, end - 0.2).lin(0, end) });
      h.layer({ wave: WAVES.sine, freq: 120, amp: new Env(0).set(0, t).lin(p.amp * 0.1, t + 0.2).lin(p.amp * 0.1, end - 0.2).lin(0, end) });
      syn.add(lane, h);
    },
  },
  hook: {
    description: 'An attention hook for the very start of a video: a fast rising sweep into a deep hit and a bright ping (about 1.2 s; the hit lands 0.3 s in).',
    trimDb: -13,
    dur: 1.2,
    play(syn, lane, t, p) {
      const rise = 0.3;
      const hit = t + rise;
      // the riser: filtered noise sweeping up, plus a thin rising tone
      const v = new Voice(t, hit + 0.05);
      v.layer({ wave: WAVES.pink, seed: seedOf(p.rng), amp: new Env(0).set(0.0001, t).exp(p.amp * 0.9, hit).lin(0, hit + 0.03) });
      v.filter = { type: 'bandpass', q: 1.2, freqEnv: new Env(350).set(350, t).exp(7000, hit) };
      v.pan = 0;
      syn.add(lane, v);
      const r = new Voice(t, hit + 0.05);
      r.layer({ wave: WAVES.sine, freqEnv: new Env(220).set(220, t).exp(1600, hit), amp: new Env(0).set(0.0001, t).exp(p.amp * 0.22, hit).lin(0, hit + 0.03) });
      syn.add(lane, r);
      // the hit: a deep thump, a burst of noise and a bright bell
      tone(syn, lane, hit, WAVES.sine, 0, p.amp * 1.1, 0.002, 0.11, { freqEnv: new Env(130).set(130, hit).exp(42, hit + 0.22), length: 0.9 });
      noiseBurst(syn, lane, hit, p.amp * 0.55, 0.05, p.rng, { type: 'lowpass', freq: 1800 });
      noiseBurst(syn, lane, hit, p.amp * 0.3, 0.02, p.rng, { type: 'highpass', freq: 4500 });
      ping(syn, lane, hit, p.tonic + 31, p.amp * 0.4, 0.7);
      ping(syn, lane, hit + 0.04, p.tonic + 38, p.amp * 0.18, 0.5, { pan: 0.25 });
    },
  },

  // ---- money, bags, locks and clocks (suspense-dilemma) ----
  cashcount: {
    description: 'A bill-counting machine: a fast riffle of paper flicks over a low motor whirr (dur = how long it counts, default 1.3 s).',
    trimDb: -19,
    dur: 1.3,
    play(syn, lane, t, p) {
      const rng = p.rng;
      const rate = 24;
      const n = Math.max(3, Math.floor(p.dur * rate));
      for (let i = 0; i < n; i++) {
        const at = t + i / rate + rng.range(-0.004, 0.004);
        const side = rng.range(-0.25, 0.25);
        noiseBurst(syn, lane, at, p.amp * rng.range(0.45, 1), 0.007, rng, { type: 'highpass', freq: rng.range(3500, 5500), q: 0.7, pan: side });
        noiseBurst(syn, lane, at + 0.003, p.amp * 0.3, 0.012, rng, { type: 'bandpass', freq: 2300, q: 1.6, pan: side });
        if (i % 6 === 0) noiseBurst(syn, lane, at, p.amp * 0.5, 0.02, rng, { type: 'bandpass', freq: 1400, q: 1.2 });
      }
      const v = new Voice(t, t + p.dur + 0.1);
      v.layer({ wave: WAVES.saw, freq: 96, amp: new Env(0).set(0, t).lin(p.amp * 0.12, t + 0.08).lin(p.amp * 0.12, t + p.dur - 0.05).lin(0, t + p.dur + 0.05) });
      v.filter = { type: 'lowpass', freq: 500, q: 0.8 };
      syn.add(lane, v);
      // the last note falls into the tray with a soft slap
      noiseBurst(syn, lane, t + p.dur, p.amp * 0.5, 0.045, rng, { type: 'bandpass', freq: 1500, q: 1 });
    },
  },
  cash: {
    description: 'Thumbing through a stack of bills once: a quick fan of paper flicks, slowing at the end (money being checked).',
    trimDb: -18,
    play(syn, lane, t, p) {
      const rng = p.rng;
      let at = t;
      for (let i = 0; i < 14; i++) {
        noiseBurst(syn, lane, at, p.amp * rng.range(0.5, 1) * (1 - i * 0.03), 0.011, rng, { type: 'bandpass', freq: rng.range(3000, 4800), q: 1.1, pan: rng.range(-0.2, 0.2) });
        noiseBurst(syn, lane, at, p.amp * 0.25, 0.004, rng, { type: 'highpass', freq: 6500 });
        at += 0.026 + i * 0.0035;
      }
    },
  },
  stack: {
    description: 'A banded bundle of bills dropped on a table or into a bag: a dull thump and a papery slap.',
    trimDb: -17,
    play(syn, lane, t, p) {
      tone(syn, lane, t, WAVES.sine, 0, p.amp * 0.9, 0.002, 0.05, { freqEnv: new Env(150).set(150, t).exp(65, t + 0.12), length: 0.4 });
      noiseBurst(syn, lane, t, p.amp * 0.55, 0.05, p.rng, { type: 'bandpass', freq: 1800, q: 0.9 });
      noiseBurst(syn, lane, t + 0.03, p.amp * 0.2, 0.025, p.rng, { type: 'highpass', freq: 4500 });
    },
  },
  zip: {
    description: 'A zipper pulled open (dur, default 0.5 s): a ratchet of tiny clicks that speeds up and rises.',
    trimDb: -19,
    dur: 0.5,
    play(syn, lane, t, p) {
      const rng = p.rng;
      let at = t;
      let k = 0;
      while (at < t + p.dur) {
        const prog = (at - t) / p.dur;
        noiseBurst(syn, lane, at, p.amp * rng.range(0.55, 1), 0.003, rng, { type: 'bandpass', freq: 2600 + prog * 3200, q: 2.5, pan: -0.15 + prog * 0.3 });
        at += 1 / (30 + prog * 45);
        k++;
      }
      noiseBurst(syn, lane, t + p.dur, p.amp * 0.35, 0.02, rng, { type: 'bandpass', freq: 1500, q: 3 });
    },
  },
  lock: {
    description: 'A door lock turned from the inside: a metal clack, a short pause, a second deeper clack.',
    trimDb: -16,
    play(syn, lane, t, p) {
      const rng = p.rng;
      for (const [dt, f0, f1, midi, gain] of [[0, 330, 190, 82, 1], [0.16, 210, 110, 70, 0.9]]) {
        const a = t + dt;
        tone(syn, lane, a, WAVES.sine, 0, p.amp * gain, 0.001, 0.03, { freqEnv: new Env(f0).set(f0, a).exp(f1, a + 0.06), length: 0.3 });
        noiseBurst(syn, lane, a, p.amp * 0.4 * gain, 0.008, rng, { type: 'bandpass', freq: 2600, q: 2 });
        ping(syn, lane, a, midi, p.amp * 0.25 * gain, 0.1, { partials: [[1, 1, 1], [2.3, 0.6, 0.6], [4.1, 0.3, 0.4]] });
      }
    },
  },
  drag: {
    description: 'A heavy bag dragged across gravel (dur, default 1.4 s): a low scrape with grit and bumps.',
    trimDb: -17,
    dur: 1.4,
    play(syn, lane, t, p) {
      const rng = p.rng;
      let at = t;
      while (at < t + p.dur) {
        const len = rng.range(0.1, 0.22);
        noiseBurst(syn, lane, at, p.amp * rng.range(0.5, 1), len * 0.45, rng, { type: 'lowpass', freq: rng.range(500, 900), q: 0.7, pink: true });
        for (let g = 0; g < 5; g++) noiseBurst(syn, lane, at + rng.range(0, len), p.amp * 0.18, 0.006, rng, { type: 'highpass', freq: rng.range(2500, 5000) });
        at += len * rng.range(0.8, 1.1);
      }
    },
  },
  clock: {
    description: 'A slow clock ticking, tick tock (pitch = number of ticks, default 6; dur = how long they take, default 3.6 s): dry wooden ticks, one a little lower.',
    trimDb: -22,
    dur: 3.6,
    play(syn, lane, t, p) {
      const n = Math.max(1, Math.min(24, Math.round(p.pitch ?? 6)));
      const gap = p.dur / n;
      for (let i = 0; i < n; i++) {
        const at = t + i * gap;
        ping(syn, lane, at, i % 2 ? 91 : 96, p.amp, 0.07, { partials: [[1, 1, 1], [2.4, 0.5, 0.5]], pan: i % 2 ? 0.1 : -0.1 });
        noiseBurst(syn, lane, at, p.amp * 0.3, 0.004, p.rng, { type: 'highpass', freq: 3500 });
      }
    },
  },
};

export const SFX_INFO = Object.fromEntries(Object.entries(SFX_DEFS).map(([k, d]) => [k, d.description]));

export function validateSfx(cues) {
  for (const cue of cues) {
    if (!cue || !SFX_DEFS[cue.name]) {
      throw new Error(`Unknown sound effect "${cue && cue.name}". Valid names: ${Object.keys(SFX_DEFS).join(', ')}`);
    }
    if (!Number.isFinite(Number(cue.t))) throw new Error(`Sound effect "${cue.name}" needs a numeric time t`);
  }
}

// Adds every cue to `lane` (a stereo lane). `tonic` is a MIDI note in the key.
export function scheduleSfx(syn, lane, cues, { tonic = 60, volume = 1, duration = Infinity } = {}) {
  cues.forEach((cue, index) => {
    const def = SFX_DEFS[cue.name];
    const t = Math.max(0, Number(cue.t));
    if (t >= duration) return;
    const gain = cue.gain == null ? 1 : Math.max(0, Number(cue.gain));
    const amp = dbToGain(def.trimDb) * gain * volume;
    if (amp <= 0) return;
    const dur = Math.max(0.05, Number(cue.dur) || def.dur || 0.5);
    const rng = makeRng(hashSeed('sfx', cue.name, t.toFixed(4), index));
    def.play(syn, lane, t, { amp, dur, pitch: cue.pitch, rng, tonic });
  });
}
