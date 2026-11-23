// Hindi voice with voice cloning: SPRINGLab/F5-Hindi-24KHz, run by F5-TTS in a
// separate Python environment (see setup-hindi-voice.sh in the repository root).
// One Python worker per run loads the model once and answers JSON lines.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cacheRoot, transcribeWords } from './models.js';
import { ProjectError } from './project.js';
import { ffmpeg, probe } from './ffmpeg.js';
import { readWav, resample } from './wav.js';

export const F5_MODEL = 'SPRINGLab/F5-Hindi-24KHz';
export const F5_SAMPLE_RATE = 24000;
// F5 clones best from 5 to 12 seconds of clean speech; longer references are cut.
const REF_SECONDS = 12;
const AUDIO_FILE = /\.(wav|mp3|m4a|aac|flac|ogg|opus)$/i;

export function f5Root() {
  return process.env.EXPLAINROO_F5_HOME || path.join(cacheRoot(), 'f5');
}

export function f5Python() {
  return process.env.EXPLAINROO_F5_PYTHON || path.join(f5Root(), 'venv', 'bin', 'python');
}

export function f5Paths() {
  const root = f5Root();
  return { root, model: path.join(root, 'model'), vocos: path.join(root, 'vocos'), defaultRef: path.join(root, 'default-ref.wav'), defaultRefText: path.join(root, 'default-ref.txt') };
}

export function f5Status() {
  const p = f5Paths();
  const python = f5Python();
  const missing = [];
  if (!fs.existsSync(python)) missing.push('Python environment');
  if (!fs.existsSync(path.join(p.model, 'model_2500000.safetensors'))) missing.push('model');
  if (!fs.existsSync(path.join(p.vocos, 'pytorch_model.bin'))) missing.push('vocoder');
  if (!fs.existsSync(p.defaultRef) || !fs.existsSync(p.defaultRefText)) missing.push('default voice sample');
  return { ok: !missing.length, missing, ...p, python };
}

function requireF5() {
  const s = f5Status();
  if (!s.ok) throw new ProjectError(`The Hindi F5 voice is not set up (missing: ${s.missing.join(', ')}). Run: sh setup-hindi-voice.sh`);
}

// Starts the worker and waits until the model is loaded.
export function loadF5({ log = () => {} } = {}) {
  requireF5();
  const p = f5Paths();
  const script = fileURLToPath(new URL('./f5_worker.py', import.meta.url));
  const child = spawn(f5Python(), ['-I', script, p.model], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: '1', TOKENIZERS_PARALLELISM: 'false', HF_HUB_OFFLINE: '1' } });
  const pending = new Map();
  let nextId = 1;
  let buf = '';
  let stderr = '';
  let readyResolve;
  let readyReject;
  const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.ready) readyResolve(msg);
      else if (pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new ProjectError(`F5 voice: ${msg.error}`)); else resolve(msg);
      }
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
  const fail = (why) => {
    const err = new ProjectError(`The F5 voice stopped (${why}).${stderr.trim() ? ` Last output:\n${stderr.trim().split('\n').slice(-6).join('\n')}` : ''}`);
    readyReject(err);
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
  };
  child.on('error', (e) => fail(e.message));
  child.on('exit', (code, sig) => fail(`exit ${code ?? sig}`));
  log('loading the Hindi F5 voice model');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-f5-'));
  const worker = {
    tmp,
    ready,
    async generate({ text, refAudio, refText, speed = 1, seed = 0 }) {
      const id = nextId++;
      const out = path.join(tmp, `${id}.wav`);
      const done = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      child.stdin.write(JSON.stringify({ id, text, refAudio, refText, speed, seed, out }) + '\n');
      await done;
      const wav = readWav(out);
      fs.rmSync(out, { force: true });
      return { audio: wav.samples, sampling_rate: wav.sampleRate };
    },
    close() {
      child.stdin.end();
      child.kill();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
  return ready.then(() => worker);
}

// Turns voice.ref into a mono 24 kHz WAV of at most 12 seconds in build/f5-ref/
// and finds the words spoken in it. Returns { file, text, hash }.
export async function prepareReference(project, voice, { log = () => {} } = {}) {
  const p = f5Paths();
  let source;
  let text = voice.refText;
  if (voice.ref) {
    source = path.join(project.dir, voice.ref);
    if (!fs.existsSync(source)) throw new ProjectError(`${voice.ref} is missing. Put your reference voice (a clean 5 to 12 second recording) in assets/ and check voice.ref.`);
    const assets = path.join(fs.realpathSync(project.dir), 'assets');
    if (!fs.realpathSync(source).startsWith(assets + path.sep)) throw new ProjectError('voice.ref must stay inside assets/, including symlinks');
    if (!AUDIO_FILE.test(source)) throw new ProjectError('voice.ref must be a wav, mp3, m4a, aac, flac, ogg or opus file');
    if (text === undefined) {
      const sidecar = source.replace(/\.[^.]+$/, '.txt');
      if (fs.existsSync(sidecar)) text = fs.readFileSync(sidecar, 'utf8');
    }
  } else {
    source = p.defaultRef;
    if (text === undefined) text = fs.readFileSync(p.defaultRefText, 'utf8');
  }
  const info = await probe(source);
  if (!info.streams.find((s) => s.codec_type === 'audio')) throw new ProjectError('the reference voice file has no audio');
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  const dir = path.join(project.paths.build, 'f5-ref');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sourceHash.slice(0, 12)}.wav`);
  if (!fs.existsSync(file)) {
    await ffmpeg(['-loglevel', 'error', '-y', '-i', source, '-vn', '-ac', '1', '-ar', String(F5_SAMPLE_RATE), '-t', String(REF_SECONDS), '-af', 'loudnorm=I=-20:TP=-2', '-c:a', 'pcm_s16le', file]);
  }
  const cachedText = file.replace(/\.wav$/, '.heard.txt');
  if (text === undefined && fs.existsSync(cachedText)) text = fs.readFileSync(cachedText, 'utf8');
  if (text === undefined) {
    // Whisper small is weaker in Hindi, so the cloned voice can mumble if this is wrong.
    log('the reference voice has no text; writing it down with Whisper (check it, or set voice.refText)');
    const wav = readWav(file);
    const heard = await transcribeWords(resample(wav.samples, wav.sampleRate, 16000), { log, language: 'hi' });
    text = heard.text;
    log(`reference text heard: ${text}`);
    fs.writeFileSync(cachedText, text);
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) throw new ProjectError('could not find the words spoken in the reference voice. Set voice.refText to what it says.');
  return { file, text, hash: crypto.createHash('sha256').update(sourceHash + '\n' + text).digest('hex').slice(0, 16) };
}
