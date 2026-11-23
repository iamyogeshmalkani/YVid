// Checks for shots.js, shared by scripts/check-shots.mjs and scripts/shot-images.mjs. Nothing here needs the engine.
// lint(mod, { words, language }) -> { errors: [], warnings: [] }
//   mod:   the module shots.js exports (SHOTS, CAST, SETS, PACE, promptFor, needsPicture)
//   words: [{ text, start, end }] of the narration (from the timeline), optional; with it the words and the durations are checked
//
// How long a picture stays, by PACE (measured on the references: 0.81 to 0.88 s on average for the fast ones, 1.5 to 1.6 s for the calm ones).
export const PACES = {
  fast: { min: 0.55, max: 1.3, target: 0.9 },
  calm: { min: 1.0, max: 2.6, target: 1.6 },
};
// Words that describe a person. A cast member is always written as {key}, so these words may not appear in a scene by hand
// (that is how one character turns into another between pictures). Set `extras: true` on a shot for a crowd or a one-off person.
const PEOPLE = /\b(boy|boys|girl|girls|man|men|woman|women|child|children|kid|kids|baby|teen|teenager|lady|guy|guys|grandfather|grandmother|grandpa|grandma|father|mother|person|people|driver|friend|friends)\b/gi;
const STOP = new Set('about after again around because before being could every from have into just like made make more only other over really said some than that their them then there these they this those through very want were what when where which while with would your'.split(' '));
const SIZES = ['close-up', 'medium close-up', 'extreme close-up', 'medium shot', 'wide shot', 'top-down view', 'low angle shot', 'over-the-shoulder shot', 'high angle shot'];

export function lint(mod, { words = null, language = 'en' } = {}) {
  const errors = [];
  const warnings = [];
  const { SHOTS, CAST, SETS, promptFor } = mod;
  const pace = PACES[mod.PACE] || PACES.fast;
  if (!PACES[mod.PACE]) warnings.push(`PACE "${mod.PACE}" is not one of ${Object.keys(PACES).join(', ')}; using fast`);
  const needsPicture = mod.needsPicture || ((x) => x.card === undefined && !x.split);
  const err = (n, m) => errors.push(n ? `shot ${n}: ${m}` : m);
  const warn = (n, m) => warnings.push(n ? `shot ${n}: ${m}` : m);
  if (!Array.isArray(SHOTS) || !SHOTS.length || SHOTS[0].says === 'TODO') { err(0, 'SHOTS is empty: run  node scripts/plan-shots.mjs <project>  after `voice`'); return { errors, warnings }; }
  for (const [k, c] of Object.entries(CAST)) {
    for (const f of ['noun', 'short', 'age', 'height', 'weight', 'build', 'face', 'hair', 'outfit']) if (c[f] === undefined || c[f] === '') err(0, `CAST.${k} has no "${f}"`);
    if (typeof c.height !== 'number' || c.height <= 0 || c.height > 1.05) err(0, `CAST.${k}.height must be a number above 0 and at most 1 (1 = the tallest grown-up)`);
  }
  const numbers = new Set(SHOTS.map((x) => x.n));
  let prevWord = -1;
  SHOTS.forEach((shot, i) => {
    const n = shot.n ?? i + 1;
    if (shot.n !== i + 1) err(n, `shots must be numbered 1, 2, 3 ... in order (this one is at position ${i + 1})`);
    if (typeof shot.word !== 'number') err(n, 'has no "word" (the index of its first narration word)');
    else {
      if (i === 0 && shot.word !== 0) err(n, 'the first shot must start at word 0');
      if (shot.word <= prevWord) err(n, `starts at word ${shot.word}, not after the previous shot (${prevWord})`);
      prevWord = shot.word;
    }
    if (!shot.says) err(n, 'has no "says" (the narration of this shot)');
    if (shot.card !== undefined) {
      if (!Number.isInteger(shot.card) || shot.card < 1 || shot.card > 99) err(n, `card must be a whole number from 1 to 99 (is ${JSON.stringify(shot.card)})`);
      return;
    }
    if (shot.split) {
      if (!Array.isArray(shot.split) || shot.split.length !== 2) { err(n, 'split must name two shots: split: [12, 40]'); return; }
      for (const m of shot.split) {
        const other = SHOTS.find((x) => x.n === m);
        if (!numbers.has(m) || !other) err(n, `split names shot ${m}, which does not exist`);
        else if (!needsPicture(other)) err(n, `split names shot ${m}, which has no picture of its own`);
      }
      return;
    }
    for (const f of ['shot', 'action']) if (!shot[f] || /^TODO/.test(shot[f])) err(n, `"${f}" is not written yet`);
    if (shot.shot && !/^TODO/.test(shot.shot) && !SIZES.includes(shot.shot)) warn(n, `shot size "${shot.shot}" is unusual (usual: ${SIZES.join(', ')})`);
    if (!Array.isArray(shot.who)) err(n, '"who" must be a list of CAST keys (an empty list for a place or an object)');
    for (const k of shot.who || []) if (!CAST[k]) err(n, `"${k}" is in "who" but not in CAST`);
    if ((shot.who || []).length > 3) warn(n, 'more than 3 characters in one picture: the model will mix them up; use 2 if you can');
    if (shot.mark !== undefined && !['cross', 'check'].includes(shot.mark)) err(n, `mark must be "cross" or "check" (is "${shot.mark}")`);
    if (shot.action && !/^TODO/.test(shot.action)) {
      const used = [...shot.action.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const u of used) if (!CAST[u] && !SETS[u]) err(n, `{${u}} is neither in CAST nor in SETS`);
      for (const k of shot.who || []) if (!used.includes(k)) err(n, `${k} is in "who" but {${k}} is not in the action`);
      for (const u of used) if (CAST[u] && !(shot.who || []).includes(u)) err(n, `{${u}} is in the action but not in "who"`);
      const bare = shot.action.replace(/\{\w+\}/g, ' ');
      const hits = [...new Set((bare.match(PEOPLE) || []).map((w) => w.toLowerCase()))];
      if (hits.length && !shot.extras) err(n, `the action describes people by hand ("${hits.join('", "')}"). Write a recurring person as {key} (add them to CAST) so they look the same in every picture; for a crowd or a person seen once add  extras: true  to the shot`);
      const count = bare.trim().split(/\s+/).length;
      if (count > 40) warn(n, `the action has ${count} words; a picture model follows about 35. Show one moment.`);
      if (/\b(text|sign that says|written|caption|label|letters?|numbers? on)\b/i.test(bare)) warn(n, 'the action asks for text or numbers in the picture; the model cannot draw them. Leave words to the caption (or use mark: "cross" / "check").');
      try {
        const pr = promptFor(shot);
        // Perchance cuts a prompt at 1500 characters (src/perchance.js): everything after that, usually the characters' hair and outfit and
        // the scene, never reaches the picture maker, so characters drift. Keep shots.js prompts short (see `brief` in CAST).
        if (pr.length > 1500) warn(n, `the picture prompt is ${pr.length} characters; Perchance cuts it at 1500, so the end (the characters' details) is lost`);
      } catch (e) { err(n, e.message); }
    }
  });
  // neighbours that would look the same: same people, same set, same size
  for (let i = 1; i < SHOTS.length; i++) {
    const a = SHOTS[i - 1];
    const b = SHOTS[i];
    if (!needsPicture(a) || !needsPicture(b) || !a.shot || !b.shot) continue;
    if (a.shot === b.shot && (a.set || '') === (b.set || '') && JSON.stringify([...(a.who || [])].sort()) === JSON.stringify([...(b.who || [])].sort()) && (a.who || []).length) {
      warn(b.n, `same people, same place and same shot size as shot ${a.n}: the cut will look like a jump. Change the size (close-up / wide shot), the angle or the pose.`);
    }
  }
  const me = CAST.me ? SHOTS.filter((x) => (x.who || []).includes('me')).length : 0;
  if (CAST.me && !me) warn(0, 'the narrator mascot {me} is in no shot; the references show it for "I", for reactions and at the end (about 1 picture in 5 to 8)');
  if (words) {
    const t = (j) => (j === 0 ? 0 : Math.max(0, words[j].start - 0.04));
    SHOTS.forEach((shot, i) => {
      const n = shot.n ?? i + 1;
      if (typeof shot.word !== 'number') return;
      if (shot.word >= words.length) { err(n, `starts at word ${shot.word} but the narration has only ${words.length} words`); return; }
      const next = SHOTS[i + 1];
      const end = next && typeof next.word === 'number' && next.word < words.length ? next.word : words.length;
      const slice = words.slice(shot.word, end).map((w) => w.text).join(' ');
      if (shot.says && slice !== shot.says) err(n, `its "says" no longer matches the narration (now: "${slice}"). Run  node scripts/plan-shots.mjs <project>`);
      const last = i === SHOTS.length - 1;
      const d = (last ? words[words.length - 1].end + 0.5 : t(end)) - t(shot.word);
      const lo = shot.card !== undefined ? 0.35 : pace.min;
      const msg = `lasts ${d.toFixed(2)} s; at PACE "${mod.PACE}" a picture lasts ${pace.min} to ${pace.max} s. Run  node scripts/plan-shots.mjs <project>`;
      // one long word ("₹53,68,70,912" read as a dozen spoken words) cannot be cut: only a warning
      const spoken = words[end - 1].end - t(shot.word); // without the pause after the last word
      if (!last && d > pace.max + 0.15 && (end - shot.word === 1 || spoken <= pace.max + 0.15)) warn(n, `${msg.split('. Run')[0]}, but ${end - shot.word === 1 ? 'it is a single word' : 'the rest is a pause after its words'} and cannot be cut`);
      else if (!last && (d < lo - 0.08 || d > pace.max + 0.15)) err(n, msg);
      if (last && d > pace.max + 1.2) warn(n, `the last picture lasts ${d.toFixed(1)} s`);
      // does the picture show what the words say? (English only: a content word of the narration that the picture never mentions)
      if (language === 'en' && needsPicture(shot) && shot.action && !/^TODO/.test(shot.action)) {
        const text = `${shot.shot} ${shot.action} ${shot.mood || ''} ${SETS[shot.set] || shot.set || ''} ${(shot.who || []).map((k) => Object.values(CAST[k] || {}).join(' ')).join(' ')}`.toLowerCase();
        const miss = [...new Set((shot.says.toLowerCase().match(/[a-z]{5,}/g) || []).filter((w) => !STOP.has(w)))].filter((w) => !text.includes(w.slice(0, Math.max(4, w.length - 3))));
        if (miss.length >= 2) warn(n, `the narration says "${shot.says}" but the picture never mentions: ${miss.join(', ')}. Does it show what the words say?`);
      }
    });
  }
  return { errors, warnings };
}
