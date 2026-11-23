// Turns each scene's narration into a WAV file plus word timings.
// Results are cached per scene in build/voice/<scene>.json and only
// regenerated when the words, markers, voice, speed or pacing change.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { speechChunks, resolveMarks, normWord } from './script.js';
import { alignWords, readAlike } from './align.js';
import { loadTTS, transcribeWords, TTS_MODEL, TTS_SAMPLE_RATE, ttsDtype, asrModel } from './models.js';
import { phonemize, generateSpeech } from './phonemes.js';
import { writeWav, readWav, resample, trimSilence, boostRegions } from './wav.js';
import { recordingFiles, decodeRecording, saveRecording, recordingCuts, recordingWords } from './recordings.js';
import { ffmpeg } from './ffmpeg.js';
import { loadF5, prepareReference, F5_MODEL, F5_SAMPLE_RATE } from './f5.js';
import { loadVoxcpm, prepareVoxcpmReference, VOXCPM_MODEL, VOXCPM_SAMPLE_RATE } from './voxcpm.js';

const PIPELINE = 7;

export function sceneHash(scene, chunks, config, recording = null, f5 = null) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      PIPELINE,
      TTS_MODEL: f5 ? (config.voice.provider === 'voxcpm' ? VOXCPM_MODEL : F5_MODEL) : TTS_MODEL,
      ASR_MODEL: asrModel(config.language),
      dtype: f5 ? undefined : ttsDtype(),
      voice: config.voice,
      speed: config.speed * config.pace,
      chunks: recording ? scene.spoken : chunks.map((c) => [c.gapBefore, c.text]),
      // Markers and the shown text of each word are saved with the timings,
      // so moving a [#marker] or changing {shown|spoken} makes the scene again.
      // [loud] words and their boost: only added when a scene uses them, so other scenes keep their cache.
      ...(!recording && scene.units.some((u) => u.emph) ? { emphasis: scene.units.map((u, i) => (u.emph ? i : -1)).filter((i) => i >= 0), emphasisDb: config.emphasisDb } : {}),
      layout: (recording ? scene.units.filter((u) => u.type !== 'pause') : scene.units).map((u) => (u.type === 'mark' ? `#${u.name}` : u.type === 'word' ? u.display : '')).join('|'),
      // Deeper / darker Kokoro voice: only added when used, so other videos keep their cache.
      ...(!f5 && !recording && config.voiceFx ? { voiceFx: config.voiceFx } : {}),
      // Added last and only for recordings, so Kokoro scenes keep their cache.
      ...(recording ? { recording } : {}),
      // The reference voice (its sound and its words) is part of an F5 voice.
      ...(f5 ? { f5 } : {}),
      ...(config.language && config.language !== 'en' ? { language: config.language } : {}),
    }))
    .digest('hex')
    .slice(0, 16);
}

export function voicePaths(project, id) {
  return { wav: path.join(project.paths.voice, `${id}.wav`), json: path.join(project.paths.voice, `${id}.json`) };
}

export function readVoice(project, id) {
  const p = voicePaths(project, id);
  if (!fs.existsSync(p.json)) return null;
  try {
    return JSON.parse(fs.readFileSync(p.json, 'utf8'));
  } catch {
    return null;
  }
}

// Returns { [sceneId]: voiceInfo } and generates whatever is missing or stale.
export async function synthesize(project, { force = false, log = () => {}, only = null } = {}) {
  fs.mkdirSync(project.paths.voice, { recursive: true });
  const { config } = project;
  const provider = config.voice.provider || 'kokoro';
  const recordings = provider === 'recording' ? recordingFiles(project) : null;
  // The reference voice is prepared before the hashes, because its sound and words are part of them.
  const f5ref = provider === 'f5' ? await prepareReference(project, config.voice, { log })
    : provider === 'voxcpm' ? await prepareVoxcpmReference(project, config.voice) : null;
  const result = {};
  const todo = [];
  for (const scene of project.script.scenes) {
    const chunks = speechChunks(scene.units, { sentenceGap: config.sentenceGap, paragraphGap: config.paragraphGap, pace: config.pace, language: config.language, clauseGap: config.voice?.provider === 'voxcpm' && config.voice.level ? 0.12 : 0 });
    const recording = recordings?.files[scene.id];
    const hash = sceneHash(scene, chunks, config, recording ? {
      content: recording.hash,
      scenes: recordings.folder ? null : project.script.scenes.map((s) => s.spoken),
    } : null, f5ref?.hash ?? null);
    const cached = readVoice(project, scene.id);
    const hasAudio = !chunks.length || fs.existsSync(voicePaths(project, scene.id).wav);
    if (!force && cached && cached.hash === hash && hasAudio) {
      result[scene.id] = cached;
    } else if (only && !only.includes(scene.id) && cached) {
      result[scene.id] = cached;
    } else {
      todo.push({ scene, chunks, hash });
    }
  }
  if (!todo.length) return result;

  const needsSpeech = todo.some((t) => t.chunks.length);
  const tts = needsSpeech && provider === 'kokoro' ? await loadTTS({ log }) : null;
  const f5 = needsSpeech && provider === 'f5' ? { worker: await loadF5({ log }), ref: f5ref, sr: F5_SAMPLE_RATE }
    : needsSpeech && provider === 'voxcpm' ? { worker: await loadVoxcpm({ log }), ref: f5ref, sr: VOXCPM_SAMPLE_RATE, voxcpm: true } : null;
  const wanted = config.speed * config.pace;
  let take = null;
  let cuts = [];
  let heardTake = null;
  if (needsSpeech && recordings && !recordings.folder) {
    log('transcribing the recording and finding scene boundaries');
    take = await decodeRecording(Object.values(recordings.files)[0].file, project.paths.build, wanted);
    heardTake = await transcribeWords(resample(take.samples, take.sampleRate, 16000), { log, language: config.language });
    cuts = recordingCuts(project.script.scenes, heardTake.words, take.samples.length / take.sampleRate, config.language);
  }
  try {
  for (const { scene, chunks, hash } of todo) {
    const t0 = Date.now();
    const info = recordings && chunks.length
      ? await recordingScene(project, scene, hash, recordings.files[scene.id], take, cuts.find((c) => c.scene.id === scene.id), heardTake, log)
      : await synthesizeScene(project, scene, chunks, hash, tts, log, f5);
    result[scene.id] = info;
    if (chunks.length) {
      const warn = info.matchRate < 0.85 ? (recordings
        ? `, recording does not match script.md here (${Math.round(info.matchRate * 100)}% of words confirmed). Make script.md say what was actually said.`
        : `, check pronunciation (${Math.round(info.matchRate * 100)}% of words confirmed)`) : '';
      log(`voice ${scene.id}: ${info.duration.toFixed(1)}s in ${((Date.now() - t0) / 1000).toFixed(1)}s${warn}`);
    }
  }
  } finally {
    f5?.worker.close();
  }
  return result;
}

// Rough count of syllables (aksharas) in Hindi text, to compare how fast two sentences are spoken. Letters of other scripts count 1 per vowel group.
function syllables(text) {
  const t = String(text).normalize('NFC');
  let n = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if ((c >= '\u0915' && c <= '\u0939') || (c >= '\u0958' && c <= '\u095f')) { if (t[i + 1] !== '\u094d') n++; } else if (c >= '\u0904' && c <= '\u0914') n++;
  }
  return n || t.split(/[aeiou]+/i).length - 1 || 1;
}

// Speeds a piece of speech up (factor above 1) or slows it down without changing its pitch.
async function stretchSpeech(samples, sr, factor) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-stretch-'));
  try {
    writeWav(path.join(dir, 'in.wav'), samples, sr);
    await ffmpeg(['-i', path.join(dir, 'in.wav'), '-filter:a', `atempo=${factor.toFixed(4)}`, path.join(dir, 'out.wav')]);
    return readWav(path.join(dir, 'out.wav')).samples;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// voice.pitch / voice.dark for Kokoro: lowers the pitch without changing the speed, then adds body (140 Hz), softens the
// highs and a very short faint echo. Done before the words are timed, so the timings stay right.
async function colorVoice(samples, sr, fx) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-color-'));
  try {
    writeWav(path.join(dir, 'in.wav'), samples, sr);
    const f = [];
    if (fx.pitch) { const r = 2 ** (fx.pitch / 12); f.push(`asetrate=${Math.round(sr * r)}`, `aresample=${sr}`, `atempo=${(1 / r).toFixed(5)}`); }
    if (fx.dark) f.push('equalizer=f=140:t=q:w=1:g=3', 'equalizer=f=4500:t=q:w=1:g=-4', 'lowpass=f=9000', 'aecho=0.8:0.6:45:0.12');
    f.push(`aresample=${sr}`);
    await ffmpeg(['-i', path.join(dir, 'in.wav'), '-filter:a', f.join(','), '-ac', '1', path.join(dir, 'out.wav')]);
    return readWav(path.join(dir, 'out.wav')).samples;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function synthesizeScene(project, scene, chunks, hash, tts, log, f5 = null) {
  const { config } = project;
  const files = voicePaths(project, scene.id);
  if (!chunks.length) {
    const info = { hash, id: scene.id, duration: 0, words: [], marks: resolveMarks(scene.units, []), chunks: [], transcript: '', matchRate: 1, unmatched: [] };
    if (fs.existsSync(files.wav)) fs.rmSync(files.wav);
    fs.writeFileSync(files.json, JSON.stringify(info, null, 2));
    return info;
  }
  const sr = f5 ? f5.sr : TTS_SAMPLE_RATE;
  const pieces = [];
  let cursor = 0;
  const chunkInfo = [];
  const wordTimes = [];
  const transcripts = [];
  const unmatched = [];
  let matchedTokens = 0;
  let totalTokens = 0;

  const phonemes = !f5 && config.language !== 'en'
    ? await phonemize(chunks.map(c => c.text), config.language) : null;
  const baseSpeed = config.speed * config.pace;
  const raw = [];
  // VoxCPM takes minutes per video, so every raw piece is kept in build/voice/raw/ (named by its words and the voice).
  // Changing voice.level or voice.levelPace then only stretches the saved pieces again.
  const rawDir = path.join(project.paths.voice, 'raw');
  const rawFile = (text) => path.join(rawDir, `${crypto.createHash('sha256').update(JSON.stringify([text, f5?.ref?.hash || '', config.voice?.provider || '', config.language])).digest('hex').slice(0, 24)}.wav`);
  for (let ci = 0; ci < chunks.length; ci++) {
    const cached = f5?.voxcpm ? rawFile(chunks[ci].text) : null;
    if (cached && fs.existsSync(cached)) { const w = readWav(cached); raw.push(w.samples); continue; }
    const audio = f5
      ? await f5.worker.generate(f5.voxcpm
        ? { text: chunks[ci].text, refAudio: f5.ref.file, refText: f5.ref.text, design: f5.ref.design }
        : { text: chunks[ci].text, refAudio: f5.ref.file, refText: f5.ref.text, speed: baseSpeed })
      : await generateSpeech(tts, chunks[ci].text, { language: config.language, voice: config.voice, speed: baseSpeed, phonemes: phonemes?.[ci] });
    raw.push(trimSilence(audio.audio, audio.sampling_rate || sr));
    if (!f5 && config.voiceFx) raw[ci] = await colorVoice(raw[ci], sr, config.voiceFx);
    if (cached) { fs.mkdirSync(rawDir, { recursive: true }); writeWav(cached, raw[ci], sr); }
  }

  // voice.level (F5 and VoxCPM): F5 fits each sentence into a length it guesses from the characters, so one sentence comes out
  // slow and the next one fast. Measure the pace of every sentence in syllables a second, take the middle one as the target
  // and stretch the others (pitch stays the same) to it, by at most 25%.
  let factors = raw.map(() => 1);
  if (f5 && config.voice.level) {
    // VoxCPM: count phonemes (the syllable guess is wrong for loanwords like "एक्सपीरियंसेस"); falls back to syllables
    let ph = null;
    if (f5.voxcpm) { try { ph = await phonemize(chunks.map((c) => c.text), config.language); } catch { ph = null; } }
    const rates = raw.map((smp, ci) => (ph?.[ci] ? [...ph[ci]].filter((ch) => /\p{L}/u.test(ch)).length : syllables(chunks[ci].words.map((w) => w.spoken).join(' '))) / (smp.length / sr));
    const sorted = [...rates].sort((x, y) => x - y);
    // voice.levelPace (default 1) moves the target: 1.15 makes the whole narration about 15% faster than the middle sentence
    const target = sorted[Math.floor(sorted.length / 2)] * (Number(config.voice.levelPace) || 1);
    // VoxCPM sentences differ more (9 to 16 characters a second in one video), so it may stretch by up to 40%
    const [lo, hi] = f5.voxcpm ? [0.75, 1.4] : [0.8, 1.25];
    factors = rates.map((r) => (r > 0 && target > 0 ? Math.min(hi, Math.max(lo, target / r)) : 1));
    log(`leveling the pace to ${target.toFixed(1)} syllables a second (sentence by sentence: ${factors.map((f) => f.toFixed(2)).join(' ')})`);
  }
  const best = [];
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const samples = Math.abs(factors[ci] - 1) > 0.02 ? await stretchSpeech(raw[ci], sr, factors[ci]) : raw[ci];
    const dur = samples.length / sr;
    const heard = await transcribeWords(resample(samples, sr, 16000), { log, language: config.language });
    const alike = await readAlike(chunk.words, heard.words, config.language);
    const aligned = alignWords(alike.words, alike.heard, dur, config.language);
    best.push({ samples, dur, heard, aligned });
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const { samples, dur, heard, aligned } = best[ci];
    const gap = ci === 0 ? 0 : chunk.gapBefore;
    if (gap > 0) {
      pieces.push(new Float32Array(Math.round(gap * sr)));
      cursor += Math.round(gap * sr);
    }
    const start = cursor / sr;
    pieces.push(samples);
    cursor += samples.length;
    transcripts.push(heard.text);
    chunk.words.forEach((w, k) => {
      const a = aligned.words[k];
      wordTimes[w.unitIndex] = { start: start + a.start, end: start + a.end, matched: a.matched };
      if (!a.matched) unmatched.push(w.display);
    });
    const tokens = chunk.words.reduce((n, w) => n + (['ja', 'zh'].includes(config.language) ? Array.from(normWord(w.spoken).normalize('NFC')).length : w.spoken.split(/\s+/).length), 0);
    totalTokens += tokens;
    matchedTokens += aligned.matchRate * tokens;
    chunkInfo.push({ start, end: start + dur, text: chunk.text });
  }

  const total = new Float32Array(cursor);
  let off = 0;
  for (const p of pieces) {
    total.set(p, off);
    off += p.length;
  }
  // Words in [loud] ... [/loud] are made louder, using the timings just measured for them.
  const loudRegions = scene.units.flatMap((u, i) => (u.emph && wordTimes[i] ? [{ start: wordTimes[i].start, end: wordTimes[i].end }] : []));
  writeWav(files.wav, loudRegions.length && config.emphasisDb > 0 ? boostRegions(total, sr, loudRegions, config.emphasisDb) : total, sr);

  const words = [];
  scene.units.forEach((u, i) => {
    if (u.type !== 'word' || !wordTimes[i]) return;
    words.push({ text: u.display, spoken: u.spoken, start: round(wordTimes[i].start), end: round(wordTimes[i].end), matched: wordTimes[i].matched });
  });
  const info = {
    hash,
    id: scene.id,
    duration: round(cursor / sr),
    words,
    marks: Object.fromEntries(Object.entries(resolveMarks(scene.units, wordTimes)).map(([k, v]) => [k, round(v)])),
    chunks: chunkInfo.map((c) => ({ ...c, start: round(c.start), end: round(c.end) })),
    transcript: transcripts.join(' '),
    matchRate: totalTokens ? Math.round((matchedTokens / totalTokens) * 1000) / 1000 : 1,
    unmatched,
  };
  fs.writeFileSync(files.json, JSON.stringify(info, null, 2));
  return info;
}

async function recordingScene(project, scene, hash, source, take, cut, heardTake, log) {
  const { config } = project;
  const audio = take || await decodeRecording(source.file, project.paths.build, project.config.speed * project.config.pace);
  const sr = audio.sampleRate;
  let from = cut ? Math.floor(cut.start * sr) : 0;
  let to = cut ? Math.ceil(cut.end * sr) : audio.samples.length;
  let samples = audio.samples.subarray(from, to);
  if (cut) {
    // Whisper can include the silence between scenes in a word's timestamp.
    const trimmed = trimSilence(samples, sr, { keep: 0.15 });
    if (trimmed.length) {
      from += (trimmed.byteOffset - samples.byteOffset) / 4;
      samples = trimmed;
      to = from + samples.length;
    }
  }
  const duration = samples.length / sr;
  const local = (w) => {
    const start = Math.max(0, Math.min(duration, w.start - from / sr));
    return { ...w, start, end: Math.min(duration, Math.max(start + 0.05, w.end - from / sr)) };
  };
  const heard = heardTake ? {
    words: heardTake.words.filter((w) => w.start >= cut.start && w.start < cut.end).map(local),
  } : (!cut && recordingWords(source.file, project.config.speed * project.config.pace) ? { words: recordingWords(source.file, project.config.speed * project.config.pace) } : await transcribeWords(resample(samples, sr, 16000), { log, language: config.language }));
  const units = scene.units.filter((u) => u.type === 'word');
  const alike = await readAlike(units, heard.words, config.language);
  const aligned = alignWords(alike.words, alike.heard, duration, config.language);
  const times = cut ? cut.words.map(local) : aligned.words;
  const wordTimes = [];
  let wi = 0;
  scene.units.forEach((u, i) => { if (u.type === 'word') wordTimes[i] = times[wi++]; });
  const files = voicePaths(project, scene.id);
  await saveRecording(files.wav, samples, sr);
  const info = {
    hash, id: scene.id, duration: round(duration),
    words: units.map((u, i) => ({ text: u.display, spoken: u.spoken, start: round(times[i].start), end: round(times[i].end), matched: aligned.words[i].matched })),
    marks: Object.fromEntries(Object.entries(resolveMarks(scene.units, wordTimes)).map(([k, v]) => [k, round(v)])),
    chunks: [{ start: 0, end: round(duration), text: scene.spoken }],
    transcript: heard.words.map((w) => w.text).join(' '),
    matchRate: round(aligned.matchRate), unmatched: units.filter((u, i) => !aligned.words[i].matched).map((u) => u.display),
  };
  fs.writeFileSync(files.json, JSON.stringify(info, null, 2));
  return info;
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}

export function voiceSamples(project, id) {
  const p = voicePaths(project, id).wav;
  return fs.existsSync(p) ? readWav(p) : null;
}
