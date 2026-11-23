#!/usr/bin/env node
// THE VERIFICATION STAGE. Run it after the pictures are made and before `render`. Every picture gets a verdict, and a picture that
// is changed (remade) loses its verdict, so nothing is ever rendered unchecked. A coding agent (or a person) LOOKS at the sheets
// this script builds and writes the verdicts; the script keeps the book, remakes the bad pictures and gates the render.
//
//   node scripts/verify-shots.mjs <project>                       sheets + checklist + status (what is still to check)
//   node scripts/verify-shots.mjs <project> --ok 1-6,8,12         mark these pictures good (lists and ranges)
//   node scripts/verify-shots.mjs <project> --bad 9:two crocodiles --bad 14:croc is fat   mark pictures to remake, with the reason
//   node scripts/verify-shots.mjs <project> --remake [--perchance|--local|--cloudflare|--pollinations]
//                                                                 delete the bad pictures, make them again, they are "to check" again
//   node scripts/verify-shots.mjs <project> --gate                exit code 1 unless EVERY picture is ok (use it before render)
//
// What the sheets are: out/verify/<cast key>-N.jpg, every picture that has that character (the cast picture char-<key> comes
// first, marked REF) so that face, outfit, height and BODY WEIGHT can be compared side by side; out/verify/objects-N.jpg for the
// pictures without a character. Each tile shows the shot number and the cast keys. verify.json holds the verdicts.
//
// THE CHECKLIST (look at every tile against it):
//   1. WORDS     the picture shows what the shot says (the noun of `says` is in view; see storyboard.md).
//   2. WHO       exactly the characters in `who` and nobody else: no extra person, no second crocodile, no creature in the background.
//   3. SAME      each character looks like its REF tile: same face, same hair, same outfit and colors, same skin.
//   4. BODY      same body weight and build as REF (a slim character stays slim: no belly, no fat crocodile) and the same HEIGHT
//                ratio to the others as the numbers in CAST (a child is about half the father).
//   5. EYES      the eyes are the ones CAST describes (people: tiny black dots; no big white eyes; a crocodile: two small yellow
//                eyes of the same size). Exactly two eyes, same size, in the right place.
//   6. ANATOMY   one head, two arms, two legs (a crocodile: four legs, a tail), hands with five fingers or mittens, nothing fused.
//   7. CLEAN     no text, letters, numbers, logos, stray black lines, dark bars at the edge, paper border or frame.
// Automatic pre-checks (printed as AUTO) catch a blank picture, a dark bar at an edge and a picture that is not square. They do
// not replace your eyes.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const VALUE_FLAGS = ['--ok', '--bad'];
const project = path.resolve(args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1])) || '.');
const flag = (n) => args.includes(`--${n}`);
const values = (n) => args.flatMap((a, i) => (a === `--${n}` && args[i + 1] !== undefined ? [args[i + 1]] : []));
const require = createRequire(path.join(project, 'package.json'));
let sharp;
for (const base of [project, new URL('../../../', import.meta.url).pathname, new URL('../../../../', import.meta.url).pathname]) {
  try { sharp = createRequire(path.join(base, 'package.json'))('sharp'); break; } catch { /* try the next place */ }
}
if (!sharp) { try { sharp = require('sharp'); } catch { console.error('sharp is not installed (run npm install in the explainroo folder)'); process.exit(1); } }

const mod = await import(`${pathToFileURL(path.join(project, 'shots.js')).href}?t=${Date.now()}`);
const { SHOTS, CAST, fileOf, needsPicture } = mod;
const assets = path.join(project, 'assets');
const outDir = path.join(project, 'out', 'verify');
const bookFile = path.join(project, 'verify.json');
const EXT = ['png', 'jpg', 'jpeg', 'webp'];
const find = (base) => EXT.map((e) => path.join(assets, `${base}.${e}`)).find(fs.existsSync);
const pictures = SHOTS.filter(needsPicture).map((s) => ({ shot: s, file: find(fileOf(s)) }));
const book = fs.existsSync(bookFile) ? JSON.parse(fs.readFileSync(bookFile, 'utf8')) : {};
const save = () => fs.writeFileSync(bookFile, `${JSON.stringify(book, null, 2)}\n`);
const stamp = (f) => (f ? Math.round(fs.statSync(f).mtimeMs) : 0);
// ok | bad | todo (no verdict, or the picture changed after the verdict)
const state = (p) => {
  if (!p.file) return { v: 'missing' };
  const e = book[p.shot.n];
  if (!e || e.stamp !== stamp(p.file)) return { v: 'todo' };
  return { v: e.v, note: e.note };
};
const list = (txt) => String(txt).split(',').flatMap((part) => {
  const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
  if (!m) { console.error(`cannot read "${part}" (use 3 or 3-9 or 1,4,6-8)`); process.exit(1); }
  const a = Number(m[1]);
  const b = Number(m[2] || m[1]);
  return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
});
const byN = (n) => pictures.find((p) => p.shot.n === n);

// ----- write verdicts -----
let wrote = false;
for (const v of values('ok')) for (const n of list(v)) {
  const p = byN(n);
  if (!p) { console.error(`shot ${n} has no picture of its own`); process.exit(1); }
  if (!p.file) { console.error(`shot ${n} has no picture yet`); process.exit(1); }
  book[n] = { v: 'ok', stamp: stamp(p.file) }; wrote = true;
}
for (const v of values('bad')) {
  const m = v.match(/^(\d+)\s*[:=]\s*(.+)$/);
  if (!m) { console.error(`--bad needs a number and a reason: --bad 9:two crocodiles (got "${v}")`); process.exit(1); }
  const p = byN(Number(m[1]));
  if (!p || !p.file) { console.error(`shot ${m[1]} has no picture to mark`); process.exit(1); }
  book[m[1]] = { v: 'bad', note: m[2].trim(), stamp: stamp(p.file) }; wrote = true;
}
if (wrote) save();

// ----- remake the bad ones -----
if (flag('remake')) {
  const bad = pictures.filter((p) => state(p).v === 'bad');
  if (!bad.length) { console.log('no picture is marked bad.'); process.exit(0); }
  const log = path.join(project, 'verify-history.md');
  fs.appendFileSync(log, `\n## remake ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n${bad.map((p) => `- shot ${p.shot.n}: ${book[p.shot.n].note}`).join('\n')}\n`);
  for (const p of bad) { fs.unlinkSync(p.file); delete book[p.shot.n]; }
  save();
  const maker = ['perchance', 'local', 'cloudflare', 'pollinations'].find((m) => flag(m)) || 'perchance';
  console.log(`remaking ${bad.length} picture(s) with ${maker}: ${bad.map((p) => p.shot.n).join(', ')}`);
  const r = spawnSync('node', [new URL('./shot-images.mjs', import.meta.url).pathname, project, `--${maker}`, '--only', bad.map((p) => p.shot.n).join(',')], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
  console.log('\nThe remade pictures are "to check" again. Run this script again, look at the new sheets and give verdicts.');
  process.exit(0);
}

// ----- the automatic pre-checks -----
async function auto(file) {
  const notes = [];
  const meta = await sharp(file).metadata();
  if (Math.abs(meta.width - meta.height) > 2) notes.push(`not square (${meta.width}x${meta.height})`);
  const N = 64;
  const raw = await sharp(file).greyscale().resize(N, N, { fit: 'fill' }).raw().toBuffer();
  let sum = 0;
  for (const v of raw) sum += v;
  const mean = sum / raw.length;
  let sq = 0;
  for (const v of raw) sq += (v - mean) ** 2;
  if (Math.sqrt(sq / raw.length) < 8) notes.push('nearly blank');
  const edge = (cells) => cells.reduce((a, [x, y]) => a + raw[y * N + x], 0) / cells.length;
  const strips = {
    left: Array.from({ length: N * 2 }, (_, i) => [i % 2, Math.floor(i / 2)]),
    right: Array.from({ length: N * 2 }, (_, i) => [N - 1 - (i % 2), Math.floor(i / 2)]),
    top: Array.from({ length: N * 2 }, (_, i) => [Math.floor(i / 2), i % 2]),
    bottom: Array.from({ length: N * 2 }, (_, i) => [Math.floor(i / 2), N - 1 - (i % 2)]),
  };
  for (const [side, cells] of Object.entries(strips)) if (edge(cells) < 40 && mean > 90) notes.push(`dark bar at the ${side} edge`);
  return notes;
}

// ----- the sheets -----
const COLS = 4;
const ROWS = 3;
const T = 320;
async function tile(file, label, tint) {
  const img = await sharp(file).resize(T, T, { fit: 'cover' }).toBuffer();
  const svg = `<svg width="${T}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="${T}" height="34" fill="${tint || '#000'}" fill-opacity="0.82"/><text x="8" y="25" font-size="21" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#fff">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`;
  return sharp(img).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).toBuffer();
}
async function sheet(name, tiles) {
  const out = [];
  for (let p = 0; p * COLS * ROWS < tiles.length; p++) {
    const chunk = tiles.slice(p * COLS * ROWS, (p + 1) * COLS * ROWS);
    const comps = [];
    for (let i = 0; i < chunk.length; i++) comps.push({ input: await tile(chunk[i].file, chunk[i].label, chunk[i].tint), left: (i % COLS) * T, top: Math.floor(i / COLS) * T });
    const file = path.join(outDir, `${name}-${p + 1}.jpg`);
    await sharp({ create: { width: COLS * T, height: Math.ceil(chunk.length / COLS) * T, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(file);
    out.push(file);
  }
  return out;
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/\.jpg$/.test(f)) fs.unlinkSync(path.join(outDir, f));
const made = pictures.filter((p) => p.file);
const missing = pictures.filter((p) => !p.file);
const tintOf = (p) => ({ ok: '#118a3a', bad: '#b3261e', todo: '#333', missing: '#333' }[state(p).v]);
const labelOf = (p) => `${p.shot.n}  ${(p.shot.who || []).join('+') || 'object'}${state(p).v === 'ok' ? '  OK' : state(p).v === 'bad' ? '  BAD' : ''}`;
const sheets = [];
for (const key of Object.keys(CAST)) {
  const tiles = [];
  const ref = find(`char-${key}`);
  if (ref) tiles.push({ file: ref, label: `REF ${key}: ${CAST[key].weight}`, tint: '#1d4ed8' });
  for (const p of made.filter((q) => (q.shot.who || []).includes(key))) tiles.push({ file: p.file, label: labelOf(p), tint: tintOf(p) });
  if (tiles.length) sheets.push(...(await sheet(key, tiles)));
}
const objects = made.filter((p) => !(p.shot.who || []).length).map((p) => ({ file: p.file, label: labelOf(p), tint: tintOf(p) }));
if (objects.length) sheets.push(...(await sheet('objects', objects)));

// ----- the report -----
const autoNotes = {};
for (const p of made) { const n = await auto(p.file); if (n.length) autoNotes[p.shot.n] = n; }
const count = { ok: 0, bad: 0, todo: 0 };
for (const p of made) count[state(p).v]++;
const heights = Object.entries(CAST).map(([k, c]) => `${k} ${c.height}`).join(', ');
console.log(`VERIFY ${path.relative(process.cwd(), project) || '.'}: ${made.length} picture(s): ${count.ok} ok, ${count.bad} bad (to remake), ${count.todo} to check${missing.length ? `, ${missing.length} not made yet (${missing.map((p) => p.shot.n).join(', ')})` : ''}`);
if (Object.keys(autoNotes).length) for (const [n, notes] of Object.entries(autoNotes)) console.log(`  AUTO shot ${n}: ${notes.join('; ')}`);
for (const p of made.filter((q) => state(q).v === 'bad')) console.log(`  BAD  shot ${p.shot.n}: ${state(p).note}`);
if (count.todo || count.bad) {
  console.log(`\nSheets (look at each one, tile by tile, against the checklist at the top of this script):`);
  for (const f of sheets) console.log(`  ${path.relative(process.cwd(), f)}`);
  console.log(`\nChecklist: 1 WORDS  2 WHO (no extras)  3 SAME as REF  4 BODY weight + height (${heights})  5 EYES  6 ANATOMY  7 CLEAN`);
  console.log(`Then:  --ok 1-6,8   --bad 9:two crocodiles   and  --remake  for the bad ones. A remade picture must be checked again.`);
}
const wordsOf = (p) => `${p.shot.n}\t${(p.shot.who || []).join('+') || '-'}\t${p.shot.says}`;
fs.writeFileSync(path.join(outDir, 'checklist.tsv'), `shot\twho\tsays\tstate\n${pictures.map((p) => `${wordsOf(p)}\t${state(p).v}${state(p).note ? `: ${state(p).note}` : ''}`).join('\n')}\n`);
if (flag('gate')) {
  const ok = !missing.length && !count.bad && !count.todo;
  console.log(ok ? '\nGATE: every picture is verified. You can render.' : '\nGATE: NOT PASSED. Verify every picture (ok) before you render.');
  process.exit(ok ? 0 : 1);
}
