#!/usr/bin/env node
// (Also cuts thin black lines off the edges, which some pictures have.)
// Picture models sometimes draw the picture on a sheet of paper: a plain white or cream border, often with a torn edge, around a
// smaller picture. The references never have one (their photo border is drawn by the kit, on purpose). This finds such a border
// and cuts it off, then scales the picture back to its own shape. Pictures without a border are left alone.
//
//   node scripts/trim-borders.mjs <project>               every assets/shotNN picture (shot-images.mjs runs this after each batch)
//   node scripts/trim-borders.mjs <project> --dry-run     only report
//   node scripts/trim-borders.mjs <project> --only 5,12
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const project = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only') || '.');
const dry = args.includes('--dry-run');
const only = (() => { const i = args.indexOf('--only'); return i >= 0 ? args[i + 1].split(',').map((n) => `shot${String(n).padStart(2, '0')}`) : null; })();
const require = createRequire(new URL('../../../package.json', import.meta.url));
const sharp = require('sharp');

const MAX = 0.14; // a border is at most 14% of the side
// a row or column is "paper" when it is light, colorless and nearly flat (the edge of a torn sheet is allowed some noise)
function isPaper(data, w, h, ch, get) {
  let light = 0;
  const n = get.length;
  for (const [x, y] of get) {
    const i = (y * w + x) * ch;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.min(r, g, b) > 214 && Math.max(r, g, b) - Math.min(r, g, b) < 26) light++;
  }
  return light / n > 0.9;
}

// a row or column is a "dark edge line" when nearly every pixel is almost black: the thin black line some models leave on an edge
function isDark(data, w, h, ch, get) {
  let dark = 0;
  for (const [x, y] of get) {
    const i = (y * w + x) * ch;
    if (Math.max(data[i], data[i + 1], data[i + 2]) < 55) dark++;
  }
  return dark / get.length > 0.85;
}

// Cuts off (1) a paper border (white or cream, at least three sides) and (2) thin black lines or bars on the edges, then scales the
// picture back to its own shape (works for the tall 9:16 pictures of this template and for square ones).
export async function trimFile(file) {
  const img = sharp(file);
  const { width: W, height: H } = await img.metadata();
  const s = 256;
  const { data, info } = await img.clone().resize(s, s, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const row = (y) => Array.from({ length: s }, (_, x) => [x, y]);
  const col = (x) => Array.from({ length: s }, (_, y) => [x, y]);
  const sides = [(k) => row(k), (k) => row(s - 1 - k), (k) => col(k), (k) => col(s - 1 - k)];
  const lim = Math.round(s * MAX);
  // walk in from each side while the line is paper; then step a little further to clear a torn edge
  const walk = (line) => { let k = 0; while (k < lim && isPaper(data, s, s, ch, line(k))) k++; return k; };
  let cut = sides.map(walk);
  const found = cut.filter((v) => v >= 2).length;
  const cutOut = { top: 0, bottom: 0, left: 0, right: 0 };
  const names = ['top', 'bottom', 'left', 'right'];
  if (found >= 3) { // a light sky or wall on one side is not a border; a sheet of paper shows on at least three sides
    const pad = Math.round(s * 0.035); // the torn edge and rounded corners
    cut = cut.map((v) => (v >= 2 ? v + pad : v));
    cut.forEach((v, k) => { cutOut[names[k]] = v; });
  }
  // thin black lines on an edge (at most 4% deep: a wider dark area is the picture itself, e.g. a night sky, and stays)
  const darkLim = Math.round(s * 0.04);
  let darkFound = false;
  sides.forEach((line, k) => {
    let d = 0;
    while (d < darkLim && isDark(data, s, s, ch, line(cutOut[names[k]] + d))) d++;
    if (d >= 1 && d < darkLim) { cutOut[names[k]] += d + 2; darkFound = true; }
  });
  if (found < 3 && !darkFound) return null;
  const { top, bottom, left, right } = cutOut;
  const frac = Math.min((s - left - right) / s, (s - top - bottom) / s);
  const cx = (left + (s - left - right) / 2) / s;
  const cy = (top + (s - top - bottom) / 2) / s;
  const bw = Math.round(frac * W), bh = Math.round(frac * H);
  const box = { left: Math.max(0, Math.min(W - bw, Math.round(cx * W - bw / 2))), top: Math.max(0, Math.min(H - bh, Math.round(cy * H - bh / 2))), width: bw, height: bh };
  return { box, W, H, cut: cutOut, kind: [found >= 3 ? 'a paper border' : null, darkFound ? 'a black edge line' : null].filter(Boolean).join(' and ') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.join(project, 'assets');
  const files = fs.readdirSync(dir).filter((f) => /^shot\d+\.(png|jpe?g|webp)$/i.test(f) && (!only || only.includes(f.replace(/\.\w+$/, ''))));
  let n = 0;
  for (const f of files) {
    const file = path.join(dir, f);
    const r = await trimFile(file);
    if (!r) continue;
    n++;
    console.log(`${f}: ${r.kind} (${Object.entries(r.cut).map(([k, v]) => `${k} ${Math.round((v / 256) * 100)}%`).join(', ')})${dry ? '' : ', cut off'}`);
    if (dry) continue;
    const buf = await sharp(file).extract(r.box).resize(r.W, r.H).toBuffer();
    fs.writeFileSync(file, buf);
  }
  console.log(`${files.length} picture(s) looked at, ${n} with a border or edge line${dry ? ' (dry run: nothing changed)' : ''}.`);
}
