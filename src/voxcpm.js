// Voice design and voice cloning with VoxCPM2 (OpenBMB, 2B parameters, 30 languages including Hindi), run in a
// separate Python environment (see setup-voxcpm-voice.sh in the repository root). One Python worker per run loads
// the model once and answers JSON lines.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cacheRoot } from './models.js';
import { ProjectError } from './project.js';
import { ffmpeg, probe } from './ffmpeg.js';
import { readWav } from './wav.js';

export const VOXCPM_MODEL = 'openbmb/VoxCPM2';
export const VOXCPM_SAMPLE_RATE = 48000;
// VoxCPM2 clones from a few seconds of clean speech; longer references are cut.
const REF_SECONDS = 20;
const AUDIO_FILE = /\.(wav|mp3|m4a|aac|flac|ogg|opus)$/i;

export function voxcpmRoot() {
  return process.env.EXPLAINROO_VOXCPM_HOME || path.join(cacheRoot(), 'voxcpm');
}

export function voxcpmPython() {
  return process.env.EXPLAINROO_VOXCPM_PYTHON || path.join(voxcpmRoot(), 'venv', 'bin', 'python');
}

export function voxcpmStatus() {
  const root = voxcpmRoot();
  const model = path.join(root, 'model');
  const python = voxcpmPython();
  const missing = [];
  if (!fs.existsSync(python)) missing.push('Python environment');
  if (!fs.existsSync(path.join(model, 'model.safetensors')) || !fs.existsSync(path.join(model, 'config.json'))) missing.push('model');
  return { ok: !missing.length, missing, root, model, python };
}

// Starts the worker and waits until the model is loaded.
export function loadVoxcpm({ log = () => {} } = {}) {
  const s = voxcpmStatus();
  if (!s.ok) throw new ProjectError(`The VoxCPM voice is not set up (missing: ${s.missing.join(', ')}). Run: sh setup-voxcpm-voice.sh`);
  const script = fileURLToPath(new URL('./voxcpm_worker.py', import.meta.url));
  const child = spawn(s.python, ['-I', script, s.model], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: '1', TOKENIZERS_PARALLELISM: 'false' } });
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
        if (msg.error) reject(new ProjectError(`VoxCPM voice: ${msg.error}`)); else resolve(msg);
      }
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
  const fail = (why) => {
    const err = new ProjectError(`The VoxCPM voice stopped (${why}).${stderr.trim() ? ` Last output:\n${stderr.trim().split('\n').slice(-6).join('\n')}` : ''}`);
    readyReject(err);
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
  };
  child.on('error', (e) => fail(e.message));
  child.on('exit', (code, sig) => fail(`exit ${code ?? sig}`));
  log('loading the VoxCPM2 voice model (it can generate slower than real time on this Mac)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-voxcpm-'));
  const worker = {
    tmp,
    ready,
    async generate({ text, refAudio, refText, design, style, seed = 0 }) {
      const id = nextId++;
      const out = path.join(tmp, `${id}.wav`);
      const done = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      child.stdin.write(JSON.stringify({ id, text, refAudio, refText, design, style, seed, out }) + '\n');
      await done;
      const wav = readWav(out);
      fs.rmSync(out, { force: true });
      fs.rmSync(`${out}.design.wav`, { force: true });
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

// Turns voice.ref into a mono WAV of at most 20 seconds in build/voxcpm-ref/.
// Returns { file, hash, text }. text (voice.refText) is optional: with it the clone is closer.
// A designed voice (voice.design) has no file; its description is the hash.
export async function prepareVoxcpmReference(project, voice) {
  if (!voice.ref) {
    if (!voice.design) throw new ProjectError('the voxcpm voice needs voice.design (a description of the voice) or voice.ref (a clean recording inside assets/).');
    return { file: null, hash: crypto.createHash('sha256').update(voice.design).digest('hex').slice(0, 16), design: voice.design };
  }
  const source = path.join(project.dir, voice.ref);
  if (!fs.existsSync(source)) throw new ProjectError(`${voice.ref} is missing. Put your reference voice (a clean 5 to 20 second recording) in assets/ and check voice.ref.`);
  const assets = path.join(fs.realpathSync(project.dir), 'assets');
  if (!fs.realpathSync(source).startsWith(assets + path.sep)) throw new ProjectError('voice.ref must stay inside assets/, including symlinks');
  if (!AUDIO_FILE.test(source)) throw new ProjectError('voice.ref must be a wav, mp3, m4a, aac, flac, ogg or opus file');
  const info = await probe(source);
  if (!info.streams.find((s) => s.codec_type === 'audio')) throw new ProjectError('the reference voice file has no audio');
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(source)).update(voice.refText || '').digest('hex');
  const dir = path.join(project.paths.build, 'voxcpm-ref');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sourceHash.slice(0, 12)}.wav`);
  if (!fs.existsSync(file)) {
    await ffmpeg(['-loglevel', 'error', '-y', '-i', source, '-vn', '-ac', '1', '-ar', '24000', '-t', String(REF_SECONDS), '-af', 'loudnorm=I=-20:TP=-2', '-c:a', 'pcm_s16le', file]);
  }
  return { file, hash: sourceHash.slice(0, 16), text: voice.refText };
}
