// [tone ...] tags: how a sentence is delivered (no voice uses them now; they are ignored).
//   [tone sad]              a preset          [tone happy pitch=90]    a preset plus an override
//   [tone rate=12]          overrides only    [tone happy=.4 surprise=.5 pitch=80]   raw emotion values
//   [tone reset]            back to the voice's own default
// A tone stays in effect until the next [tone]. Put it at the start of the sentence it should change.
export const EMOTIONS = ['happy', 'sad', 'disgust', 'fear', 'surprise', 'anger', 'other', 'neutral'];

// emotion order: happiness, sadness, disgust, fear, surprise, anger, other, neutral
export const PRESETS = {
  neutral: { emotion: [0.2, 0.03, 0.02, 0.02, 0.03, 0.02, 0.15, 0.53], pitch: 40, rate: 15 },
  curious: { emotion: [0.4, 0, 0, 0, 0.6, 0, 0.1, 0.2], pitch: 80, rate: 15 },
  serious: { emotion: [0, 0.2, 0, 0.05, 0, 0.05, 0.1, 0.6], pitch: 45, rate: 13 },
  sad: { emotion: [0, 0.7, 0, 0.1, 0, 0, 0.1, 0.1], pitch: 55, rate: 12 },
  excited: { emotion: [0.6, 0, 0, 0, 0.4, 0, 0.1, 0.1], pitch: 95, rate: 17 },
  angry: { emotion: [0, 0.1, 0.15, 0, 0, 0.6, 0, 0.15], pitch: 70, rate: 14 },
  dramatic: { emotion: [0, 0.1, 0, 0.3, 0.4, 0.1, 0.1, 0.1], pitch: 90, rate: 12 },
};
const ALIASES = { happiness: 'happy', sadness: 'sad', surprised: 'surprise', angry: 'anger' };

// Returns { reset: true } or { emotion: [8], pitch, rate }. Throws Error with a plain message.
export function parseTone(arg) {
  const words = String(arg).trim().split(/\s+/).filter(Boolean);
  if (!words.length) throw new Error('tones look like [tone sad], [tone happy pitch=90] or [tone reset]');
  if (words.length === 1 && words[0] === 'reset') return { reset: true };
  let base = null;
  const over = [];
  let pitch;
  let rate;
  for (const w of words) {
    const eq = w.indexOf('=');
    if (eq === -1) {
      if (!Object.hasOwn(PRESETS, w)) throw new Error(`unknown tone "${w}". Presets: ${Object.keys(PRESETS).join(', ')}`);
      if (base) throw new Error('use only one preset per [tone]');
      base = PRESETS[w];
      continue;
    }
    const key = ALIASES[w.slice(0, eq)] || w.slice(0, eq);
    const val = Number(w.slice(eq + 1));
    if (!Number.isFinite(val)) throw new Error(`"${w}" needs a number after the =`);
    if (key === 'pitch') {
      if (val < 0 || val > 400) throw new Error('pitch must be 0 to 400 (20 to 45 is normal speech, 60 to 150 is expressive)');
      pitch = val;
    } else if (key === 'rate') {
      if (val < 5 || val > 30) throw new Error('rate must be 5 to 30 (10 is slow, 15 normal, 30 very fast)');
      rate = val;
    } else if (EMOTIONS.includes(key)) {
      if (val < 0 || val > 1) throw new Error(`${key} must be 0 to 1`);
      over.push([EMOTIONS.indexOf(key), val]);
    } else throw new Error(`unknown setting "${key}". Known: ${[...EMOTIONS, 'pitch', 'rate'].join(', ')}`);
  }
  const emotion = [...(base ? base.emotion : [0, 0, 0, 0, 0, 0, 0, 0])];
  for (const [i, v] of over) emotion[i] = v;
  if (!emotion.some((v) => v > 0)) emotion[7] = 1;
  return { emotion, pitch: pitch ?? base?.pitch ?? 40, rate: rate ?? base?.rate ?? 15 };
}
