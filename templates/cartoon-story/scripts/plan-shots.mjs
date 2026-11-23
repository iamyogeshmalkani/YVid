#!/usr/bin/env node
// Cuts the narration into shots and writes them into shots.js (between "<SHOTS>" and "</SHOTS>").
//
//   node scripts/plan-shots.mjs <project>                after `explainroo voice <project>`
//   node scripts/plan-shots.mjs <project> --dry-run      show the plan, write nothing
//   node scripts/plan-shots.mjs <project> --target 1.0   aim at 1.0 seconds a picture (default: 0.9 at PACE fast, 1.6 at PACE calm)
//
// How the references cut (REFERENCE.md): a new picture on the first sound of a word, about every 0.85 s (fast) or 1.5 s (calm),
// usually so that the new picture lands on the noun or the verb it shows ("four types of | people", "cab | drivers"), and always
// at a sentence end when one is near. "Number one." (the word "number" and a number) always gets a shot of its own, prefilled
// as a number card. A shot whose narration did not change keeps everything you wrote for it, so you can run this again after
// changing the voice, the speed or a sentence: only new shots get an empty "TODO" action to write.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { replaceBlock } from '../lib/shotsfile.js';
import { PACES } from '../lib/lint.js';

const args = process.argv.slice(2);
const project = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--target') || '.');
const dry = args.includes('--dry-run');
const engine = (f) => import(new URL(`../../../src/${f}`, import.meta.url).href);
const { loadProject } = await engine('project.js');
const { buildTimeline } = await engine('timeline.js');

const shotsFile = path.join(project, 'shots.js');
const src = fs.readFileSync(shotsFile, 'utf8');
let mod = {};
try { mod = await import(`${pathToFileURL(shotsFile).href}?t=${Date.now()}`); } catch (e) { console.warn(`shots.js does not load (${e.message}); planning from scratch`); }
const pace = PACES[mod.PACE] || PACES.fast;
const target = Number(args[args.indexOf('--target') + 1]) || pace.target;
const LO = pace.min, HI = pace.max;

const p = loadProject(project);
if (p.script.scenes.length !== 1 || p.script.scenes[0].id !== 'story') { console.error('cartoon-story needs exactly one scene, "## story", in script.md'); process.exit(1); }
const vf = path.join(p.paths.voice, 'story.json');
if (!fs.existsSync(vf)) { console.error(`no voice yet: run  node bin/explainroo.js voice ${path.relative(process.cwd(), project)}  first`); process.exit(1); }
const words = buildTimeline(p, { story: JSON.parse(fs.readFileSync(vf, 'utf8')) }).scenes[0].words;
const N = words.length;
const bare = (j) => (words[j]?.text || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}']/gu, '');

// boundary j = the start of word j (a moment before it is said); 0 = the start of the scene, N = its end
const T = (j) => (j === 0 ? 0 : j === N ? words[N - 1].end + 0.5 : Math.max(0, words[j].start - 0.04));
const FUNCTION = new Set('a an the of in on at to for with by from into onto and but or nor so as if than that this these those his her its their my your our me him them us it he she they we i you is was are were be been am has have had do did does will would can could not no just very'.split(' '));
// "Number one" in English, Hinglish ("Number ek") and Hindi ("नंबर एक")
const NUMVAL = {};
['one two three four five six seven eight nine ten eleven twelve', 'ek do teen chaar paanch chhe saat aath nau das gyarah barah',
  'एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह'].forEach((row) => row.split(' ').forEach((w, i) => { NUMVAL[w] = i + 1; }));
Object.assign(NUMVAL, { char: 4, panch: 5, chhah: 6, chah: 6, पांच: 5, छः: 6 });
const NUMBER = new Set(['number', 'no', 'नंबर', 'नम्बर']);
const isEnd = (t) => /[.!?…।]["”')\]]*$/.test(t);

// "Number one." -> a number card of its own: cuts before "number" and after the number are required
const cards = new Map(); // first word index -> { end, value }
const must = new Set([0, N]);
for (let j = 0; j + 1 < N; j++) {
  if (NUMBER.has(bare(j)) && (NUMVAL[bare(j + 1)] || /^\d+$/.test(bare(j + 1)))) {
    const value = NUMVAL[bare(j + 1)] ?? Number(bare(j + 1));
    cards.set(j, { end: j + 2, value });
    must.add(j); must.add(j + 2);
  } else if (/^\d{1,2}\.$/.test(words[j].text) && (j === 0 || isEnd(words[j - 1].text))) { // a sentence that is only "2."
    cards.set(j, { end: j + 1, value: Number(words[j].text.slice(0, -1)) });
    must.add(j); must.add(j + 1);
  }
}
const quality = (j) => { // how good a place to cut before word j (lower is better)
  if (j === N || must.has(j)) return 0;
  const prev = words[j - 1].text;
  if (isEnd(prev)) return 0;
  if (/[,;:—–]["”')\]]*$/.test(prev)) return 0.3;
  if (p.config.language !== 'en') return 0.8;
  return FUNCTION.has(bare(j)) ? 1.4 : 0.5; // land the new picture on a content word
};
const crossesMust = (i, j) => { for (let m = i + 1; m < j; m++) if (must.has(m)) return true; return false; };
// a shot that ends on the first one or two words of a new sentence ("... you are. He") reads worse than a cut at the sentence end
// and one that starts on the last one or two words of the sentence before ("are. He claps ...")
const strands = (i, j) => {
  let pen = 0;
  for (let k = Math.max(i + 1, j - 2); k < j; k++) if (isEnd(words[k - 1].text)) pen += 1.2;
  for (let k = i; k < Math.min(i + 2, j - 1); k++) if (isEnd(words[k].text)) pen += 1.2;
  return pen;
};
function plan(lo, hi) {
  const f = new Array(N + 1).fill(Infinity);
  const from = new Array(N + 1).fill(-1);
  f[0] = 0;
  for (let i = 0; i < N; i++) {
    if (f[i] === Infinity) continue;
    for (let j = i + 1; j <= N; j++) {
      if (crossesMust(i, j)) break;
      const d = T(j) - T(i);
      const card = cards.get(i);
      if (card) { if (j !== card.end) continue; } // a number card is exactly "Number one."
      else {
        if (d > hi && j > i + 1) break;
        if (d < (j === N ? 0.3 : lo) && !(must.has(j) && j === i + 1)) continue;
      }
      const c = f[i] + (card ? 0 : 2 * Math.abs(d - target) + strands(i, j)) + quality(j);
      if (c < f[j]) { f[j] = c; from[j] = i; }
    }
  }
  if (f[N] === Infinity) return null;
  const cuts = [];
  for (let j = N; j > 0; j = from[j]) cuts.unshift(from[j]);
  return cuts;
}
let cuts = plan(LO, HI);
if (!cuts) { cuts = plan(LO * 0.6, HI * 1.4); if (cuts) console.warn('WARNING: some shots had to be shorter or longer than the pace allows (a long pause or a long word); check-shots.mjs reports them.'); }
if (!cuts) { console.error('could not cut the narration into shots (very long pauses or very long words?)'); process.exit(1); }

// keep what was written for shots whose narration did not change
const old = {};
for (const s of mod.SHOTS || []) if (s.says && (s.card !== undefined || s.split || (s.action && !/^TODO/.test(s.action)))) old[s.says] = s; // only shots that were written
let kept = 0;
const saysOf = (i) => words.slice(cuts[i], i + 1 < cuts.length ? cuts[i + 1] : N).map((w) => w.text).join(' ');
const newN = Object.fromEntries(cuts.map((_, i) => [saysOf(i), i + 1])); // narration -> new shot number
const oldSays = Object.fromEntries((mod.SHOTS || []).map((s) => [s.n, s.says])); // old shot number -> narration
const lost = [];
const entries = cuts.map((w0, i) => {
  const says = saysOf(i);
  const card = cards.get(w0);
  if (card) return { n: i + 1, word: w0, card: card.value, says };
  const was = old[says] && old[says].card === undefined ? old[says] : null;
  if (was) {
    kept++;
    if (was.split) { // a split names other shots by number: follow them to their new numbers
      const split = was.split.map((m) => newN[oldSays[m]]);
      if (split.every(Boolean)) return { ...was, split, n: i + 1, word: w0, says };
      lost.push(i + 1);
    } else return { ...was, n: i + 1, word: w0, says };
  }
  return { who: [], shot: 'medium shot', set: '', mood: '', action: 'TODO: show what the narration says, with {keys} for characters', n: i + 1, word: w0, says };
});
if (lost.length) console.warn(`shot(s) ${lost.join(', ')} were splits of shots whose narration changed; they are TODO again.`);

const durs = cuts.map((w0, i) => T(i + 1 < cuts.length ? cuts[i + 1] : N) - T(w0));
const pics = entries.filter((e) => e.card === undefined && !e.split).length;
const len = T(N);
console.log(`${N} words, ${len.toFixed(1)} s, ${cuts.length} shots (${cards.size} number card${cards.size === 1 ? '' : 's'}, ${pics} pictures to make), ${(durs.reduce((x, y) => x + y, 0) / cuts.length).toFixed(2)} s on average (shortest ${Math.min(...durs).toFixed(2)}, longest ${Math.max(...durs).toFixed(2)}), ${kept} kept from before, ${entries.filter((e) => /^TODO/.test(e.action || '')).length} to write.`);
cuts.forEach((w0, i) => console.log(`  ${String(i + 1).padStart(3)}  ${durs[i].toFixed(2)} s  ${entries[i].card !== undefined ? `[card ${entries[i].card}] ` : ''}${entries[i].says}`));
if (dry) { console.log('\n(dry run: nothing was written)'); process.exit(0); }
fs.writeFileSync(shotsFile, replaceBlock(src, entries));
console.log(`\nwrote ${path.relative(process.cwd(), shotsFile)}. Now write the "TODO" shots: for every shot read its "says", then who / shot / set / mood / action (see TEMPLATE.md).`);
