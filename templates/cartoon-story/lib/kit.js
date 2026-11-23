// cartoon-story kit for explainroo: the layout of the reference shorts (see REFERENCE.md), measured on 720 x 1280 frames and
// scaled to 1080 x 1920:
//   - black frame; a SQUARE picture band from 21.9% to 78.1% of the height (y 420 to 1500, the full width);
//   - a bold title above it in Poppins ExtraBold, white with the hook word(s) yellow (#f8c61b), the last line at 18.6% of the height;
//   - ONE spoken word at a time in small white capitals with a black edge, in the middle of the picture (50% of the height);
//   - a new still picture on (almost) every phrase, a hard cut on the first sound of a word, no camera move, no transition.
//
//   const band = pictureBand(s);
//   shots(s, SHOTS, { band, fileOf });   // the pictures, number cards, splits, marks and borders
//   title(s, TITLE);                     // the title above the picture, the whole video
//   wordCaption(s, CAPTION, band);       // one word at a time
//   badge(s, BADGE, band);               // optional: a small round avatar in the lower right corner of the picture

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const SANS = '"Poppins", "Plus Jakarta Sans", "Noto Sans Devanagari", sans-serif';
export const YELLOW = '#f8c61b';
const CREAM = '#f3ead8';

// The picture band: a square under the title (the references put it at y 280 to 1000 of 1280).
export function pictureBand(s) {
  const h = Math.min(s.W, s.H * 0.5625);
  return { x: (s.W - h) / 2, y: Math.round(s.H * 0.21875), w: h, h };
}

function wrap(ctx, text, maxWidth) {
  const lines = [''];
  for (const w of String(text).split(' ')) {
    const t = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w;
    if (ctx.measureText(t).width > maxWidth && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t;
  }
  return lines;
}

function findPicture(s, base) {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) if (s.engine.images.has(`assets/${base}.${ext}`)) return `assets/${base}.${ext}`;
  return null;
}

// Draws a picture to cover the area F; `half` = 'left' or 'right' draws only that half of the area (from the same half of the picture).
function cover(ctx, img, F, half) {
  const sc = Math.max(F.w / img.naturalWidth, F.h / img.naturalHeight);
  const w = img.naturalWidth * sc;
  const h = img.naturalHeight * sc;
  ctx.save();
  ctx.beginPath();
  if (half === 'left') ctx.rect(F.x, F.y, F.w / 2, F.h);
  else if (half === 'right') ctx.rect(F.x + F.w / 2, F.y, F.w / 2, F.h);
  else ctx.rect(F.x, F.y, F.w, F.h);
  ctx.clip();
  ctx.drawImage(img, F.x + F.w / 2 - w / 2, F.y + F.h / 2 - h / 2, w, h);
  ctx.restore();
}

// What shows while a picture is missing: a grey card with the shot number and what the picture should show.
function placeholder(ctx, F, shot, file) {
  const hue = ((shot.n || 1) * 47) % 360;
  ctx.fillStyle = `hsl(${hue},18%,30%)`;
  ctx.fillRect(F.x, F.y, F.w, F.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `800 ${F.w * 0.07}px ${SANS}`;
  ctx.fillText(`SHOT ${String(shot.n).padStart(2, '0')}`, F.x + F.w / 2, F.y + F.h * 0.14);
  ctx.font = `800 ${F.w * 0.03}px ${SANS}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  wrap(ctx, shot.action || '', F.w * 0.8).slice(0, 7).forEach((l, k) => ctx.fillText(l, F.x + F.w / 2, F.y + F.h * 0.62 + k * F.w * 0.042));
  ctx.fillStyle = CREAM;
  ctx.font = `800 ${F.w * 0.026}px ${SANS}`;
  ctx.fillText(`add assets/${file}.png`, F.x + F.w / 2, F.y + F.h * 0.93);
}

// A number card: glowing red slash marks (1 to 5) or a glowing numeral (6 and up) on a dark scratched wall, like the
// "Number two" cards of the references. Drawn here, so it costs no picture and looks the same in every video.
function numberCard(ctx, F, n, life, seed) {
  const g = ctx.createRadialGradient(F.x + F.w / 2, F.y + F.h / 2, F.w * 0.05, F.x + F.w / 2, F.y + F.h / 2, F.w * 0.75);
  g.addColorStop(0, '#3a2a2c');
  g.addColorStop(1, '#121214');
  ctx.fillStyle = g;
  ctx.fillRect(F.x, F.y, F.w, F.h);
  // faint scratches on the wall
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = F.w * 0.002;
  for (let i = 0; i < 40; i++) {
    const r = (k) => { const x = Math.sin((seed + i * 13 + k) * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const x = F.x + r(1) * F.w;
    const y = F.y + r(2) * F.h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r(3) - 0.5) * F.w * 0.25, y + (r(4) - 0.5) * F.w * 0.08);
    ctx.stroke();
  }
  ctx.restore();
  const p = easeOut(clamp(life / 0.22)); // the marks are slashed in quickly
  const glow = (draw) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255,40,40,0.95)';
    for (const [w, blur, col] of [[0.075, 0.09, 'rgba(255,30,30,0.35)'], [0.045, 0.04, '#ff2a2a'], [0.016, 0.01, '#ffd6d0']]) {
      ctx.shadowBlur = F.w * blur;
      ctx.strokeStyle = col;
      ctx.lineWidth = F.w * w;
      draw();
    }
    ctx.restore();
  };
  if (n >= 1 && n <= 5) {
    const gap = F.w * 0.13;
    const x0 = F.x + F.w / 2 - ((n - 1) * gap) / 2;
    const top = F.y + F.h * 0.28;
    const bot = F.y + F.h * 0.72;
    glow(() => {
      for (let i = 0; i < n; i++) {
        const q = clamp(p * n - i * 0.5);
        if (q <= 0) continue;
        const xa = x0 + i * gap + F.w * 0.07;
        const xb = x0 + i * gap - F.w * 0.07;
        ctx.beginPath();
        ctx.moveTo(xa, top);
        ctx.lineTo(xa + (xb - xa) * q, top + (bot - top) * q);
        ctx.stroke();
      }
    });
  } else {
    ctx.save();
    ctx.globalAlpha = p;
    ctx.font = `800 ${F.w * 0.42}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,40,40,0.95)';
    ctx.shadowBlur = F.w * 0.06;
    ctx.lineWidth = F.w * 0.02;
    ctx.strokeStyle = '#ff2a2a';
    ctx.strokeText(String(n), F.x + F.w / 2, F.y + F.h / 2);
    ctx.fillStyle = '#ffd6d0';
    ctx.fillText(String(n), F.x + F.w / 2, F.y + F.h / 2);
    ctx.restore();
  }
}

// A solid round badge in the top right corner of the picture: a green circle with a bold white tick ("this one") or a red circle with
// a bold white X ("not this"). It pops in with a small bounce at the cut. (This replaces thin neon lines across the middle of the
// picture, which covered faces and the caption.)
function markOver(ctx, F, kind, life) {
  const t = clamp(life / 0.3);
  const k = 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); // ease out back
  if (t <= 0) return;
  const good = kind === 'check';
  const R = F.w * 0.14;
  const cx = F.x + F.w * 0.8;
  const cy = F.y + F.h * 0.2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.globalAlpha = clamp(t * 3);
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = R * 0.3;
  ctx.shadowOffsetY = R * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = good ? '#22b45a' : '#e5372f';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = R * 0.12;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = R * 0.26;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  if (good) {
    ctx.moveTo(-R * 0.46, R * 0.04);
    ctx.lineTo(-R * 0.12, R * 0.38);
    ctx.lineTo(R * 0.5, -R * 0.34);
  } else {
    ctx.moveTo(-R * 0.36, -R * 0.36);
    ctx.lineTo(R * 0.36, R * 0.36);
    ctx.moveTo(R * 0.36, -R * 0.36);
    ctx.lineTo(-R * 0.36, R * 0.36);
  }
  ctx.stroke();
  ctx.restore();
}

// The pictures. list: SHOTS of shots.js. A shot starts a moment before its first word is said and stays until the next shot.
// o: { band (pictureBand(s)), fileOf (shot => 'shot07'), push (0: the pictures hold still like the references; 0.03 = a slow 3% push) }
export function shots(s, list, o = {}) {
  const F = o.band || pictureBand(s);
  const fileOf = o.fileOf || ((shot) => shot.file ?? `shot${String(shot.n).padStart(2, '0')}`);
  const push = o.push ?? 0;
  const words = s.words || [];
  const startOf = (shot, i) => {
    if (i === 0) return 0;
    if (shot.word === undefined) return s.time(shot.at);
    const w = words[shot.word];
    if (!w) throw new Error(`shot ${shot.n ?? i + 1}: word ${shot.word} does not exist (the narration has ${words.length} words). Run scripts/plan-shots.mjs again.`);
    return Math.max(0, w.start - 0.04);
  };
  const byN = new Map(list.map((x) => [x.n, x]));
  list.forEach((shot, i) => {
    const t0 = startOf(shot, i);
    const t1 = i + 1 < list.length ? startOf(list[i + 1], i + 1) : s.dur + 1;
    if (shot.card !== undefined) {
      s.draw({ at: t0, out: t1, enter: 'none', exit: 'none', sfx: false }, (ctx) => numberCard(ctx, F, Number(shot.card), s.t - t0, Number(shot.card) * 7));
      if (o.cardSfx !== false) s.sfx('whoosh', t0, { gain: 0.18 });
      return;
    }
    if (shot.split) {
      const [a, b] = shot.split.map((n) => byN.get(n));
      if (!a || !b) throw new Error(`shot ${shot.n}: split ${JSON.stringify(shot.split)} must name two shots that have pictures`);
      const fa = findPicture(s, fileOf(a));
      const fb = findPicture(s, fileOf(b));
      s.draw({ at: t0, out: t1, enter: 'none', exit: 'none', sfx: false }, (ctx) => {
        if (fa) cover(ctx, s.engine.image(fa), F, 'left'); else placeholder(ctx, { ...F, w: F.w / 2 }, a, fileOf(a));
        if (fb) cover(ctx, s.engine.image(fb), F, 'right'); else placeholder(ctx, { ...F, x: F.x + F.w / 2, w: F.w / 2 }, b, fileOf(b));
        ctx.fillStyle = '#000';
        ctx.fillRect(F.x + F.w / 2 - F.w * 0.004, F.y, F.w * 0.008, F.h);
      });
      return;
    }
    const file = fileOf(shot);
    const src = findPicture(s, file);
    s.draw({ at: t0, out: t1, enter: 'none', exit: 'none', sfx: false }, (ctx) => {
      if (!src) { placeholder(ctx, F, shot, file); return; }
      const img = s.engine.image(src);
      const life = s.t - t0;
      const z = 1 + push * clamp(life / Math.max(0.3, t1 - t0));
      let G = F;
      if (z !== 1) G = { x: F.x - (F.w * (z - 1)) / 2, y: F.y - (F.h * (z - 1)) / 2, w: F.w * z, h: F.h * z };
      ctx.save();
      ctx.beginPath();
      ctx.rect(F.x, F.y, F.w, F.h);
      ctx.clip();
      if (shot.border) { // the "snapshot" accent: the picture a little smaller inside a cream frame
        ctx.fillStyle = CREAM;
        ctx.fillRect(F.x, F.y, F.w, F.h);
        const m = F.w * 0.012;
        cover(ctx, img, { x: G.x + m, y: G.y + m, w: G.w - 2 * m, h: G.h - 2 * m });
      } else cover(ctx, img, G);
      ctx.restore();
      if (shot.mark) markOver(ctx, F, shot.mark, life);
    });
  });
}

// The title above the picture, from the first frame to the last. lines: ['AVOID THESE PEOPLE', 'AT *ALL COSTS*'].
// o: { lines, size (0.051 of the width), lastY (0.186 of the height: the middle of the last line), gap (1.18 line height), yellow }
export function title(s, o = {}) {
  if (!o || !o.lines || !o.lines.length) return;
  const yellow = o.yellow ?? YELLOW;
  s.draw({ at: 0, enter: 'none', exit: 'none', sfx: false }, (ctx) => {
    let size = (o.size ?? 0.051) * s.W;
    const gap = (o.gap ?? 1.18) * size;
    const lastY = (o.lastY ?? 0.186) * s.H;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${size}px ${SANS}`;
    const widest = Math.max(...o.lines.map((l) => ctx.measureText(l.replace(/\*/g, '')).width));
    if (widest > s.W * 0.88) { size *= (s.W * 0.88) / widest; ctx.font = `800 ${size}px ${SANS}`; }
    o.lines.forEach((line, li) => {
      const y = lastY - (o.lines.length - 1 - li) * gap;
      // *starred* words (or a *starred run of words*) are yellow
      const parts = [];
      let on = false;
      for (const piece of line.split('*')) { if (piece) parts.push({ t: piece, hl: on }); on = !on; }
      const total = parts.reduce((a, p) => a + ctx.measureText(p.t).width, 0);
      let x = s.W / 2 - total / 2;
      for (const p of parts) {
        ctx.fillStyle = p.hl ? yellow : '#ffffff';
        ctx.fillText(p.t, x, y);
        x += ctx.measureText(p.t).width;
      }
    });
  });
}

// Joins the words that the references show together: a number and its unit ("8 BILLION", "100 MILLION"), "24-7", "self-doubt".
const UNIT = /^(hundred|thousand|million|billion|trillion|percent|%|years?|km|kg)[.,!?]*$/i;
function captionWords(words, o) {
  const cased = (t) => (o.case === 'asis' ? t : t.toUpperCase());
  const clean = (t) => t.replace(/[.,;:"“”]+$/g, '').replace(/^["“”]+/g, '');
  const out = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    if (prev && (/^['’]/.test(w.text) || /^-/.test(w.text) || /-$/.test(prev.raw))) { // "Europe" + "'s", "self" + "-doubt", "24" + "-7"
      prev.text += cased(clean(w.text));
      prev.end = w.end;
      prev.raw = w.text;
      continue;
    }
    if (prev && /^[\d.,]+$/.test(prev.raw.replace(/[.,]$/, '')) && UNIT.test(w.text)) {
      prev.text += ` ${cased(clean(w.text))}`;
      prev.end = w.end;
      prev.raw = w.text;
      continue;
    }
    out.push({ text: cased(clean(w.text)), start: w.start, end: w.end, raw: w.text });
  }
  return out;
}

// One spoken word at a time, small white capitals with a black edge and a soft shadow, in the middle of the picture.
// o: { case ('upper' | 'asis'), size (0.036 of the width), y (0.5 of the height), hold (0.6 s: how long a word stays after it ends
//      when nothing follows) }
export function wordCaption(s, o = {}, F = pictureBand(s)) {
  const list = captionWords(s.words || [], o);
  if (!list.length) return;
  const hold = o.hold ?? 0.6;
  s.draw({ at: 0, enter: 'none', exit: 'none', sfx: false }, (ctx) => {
    const t = s.t;
    let w = null;
    for (let i = 0; i < list.length; i++) {
      const next = list[i + 1];
      const from = list[i].start - 0.03;
      const until = next ? Math.min(next.start - 0.03, list[i].end + hold) : list[i].end + hold;
      if (t >= from && t < until) { w = list[i]; break; }
    }
    if (!w) return;
    let size = (o.size ?? 0.036) * s.W;
    ctx.font = `800 ${size}px ${SANS}`;
    const width = ctx.measureText(w.text).width;
    if (width > F.w * 0.8) { size *= (F.w * 0.8) / width; ctx.font = `800 ${size}px ${SANS}`; }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = s.W / 2;
    const y = s.H * (o.y ?? 0.5);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.35;
    ctx.shadowOffsetY = size * 0.06;
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(w.text, x, y);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(w.text, x, y);
    ctx.restore();
  });
}

// A small round badge (a channel avatar) in the lower right corner of the picture, the whole video.
export function badge(s, src, F = pictureBand(s)) {
  if (!src || !s.engine.images.has(src)) return;
  s.draw({ at: 0, enter: 'none', exit: 'none', sfx: false }, (ctx) => {
    const r = F.w * 0.035;
    const cx = F.x + F.w - r * 2.2;
    const cy = F.y + F.h - r * 2.2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.clip();
    const img = s.engine.image(src);
    const sc = Math.max((2 * r) / img.naturalWidth, (2 * r) / img.naturalHeight);
    ctx.drawImage(img, cx - (img.naturalWidth * sc) / 2, cy - (img.naturalHeight * sc) / 2, img.naturalWidth * sc, img.naturalHeight * sc);
    ctx.restore();
  });
}
