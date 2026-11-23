"""Worker for explainroo's VoxCPM voice (openbmb/VoxCPM2: voice design and voice cloning, 30 languages).

Started by src/voxcpm.js as:  python -I voxcpm_worker.py <model folder>
Reads one JSON request per line on stdin and answers one JSON line on stdout.
  request : {"id", "text", "out", "seed", optional "refAudio" (clone a recording), "refText" (its words, for the
              high-fidelity clone), "design" (a description of the voice, used when there is no refAudio),
              "style" (a delivery hint such as "slightly faster, cheerful")}
  reply   : {"id", "out"}  or  {"id", "error"}
A designed voice would sound different on every call, so the first call for a description makes a reference clip
and every later call clones that clip: the whole video keeps one voice.
Everything else (progress bars) goes to stderr so stdout stays clean.
"""
import json
import os
import sys

reply = sys.stdout
sys.stdout = sys.stderr

model_dir = sys.argv[1]

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from voxcpm import VoxCPM  # noqa: E402

model = VoxCPM.from_pretrained(model_dir, load_denoiser=False)
rate = int(model.tts_model.sample_rate)
design_refs = {}
DESIGN_LINE = "Every long journey starts with a single, quiet step forward."


def send(obj):
    reply.write(json.dumps(obj) + "\n")
    reply.flush()


def seed(n):
    torch.manual_seed(n)
    np.random.seed(n % (2**32))


def reference_for(req):
    if req.get("refAudio"):
        return req["refAudio"]
    design = (req.get("design") or "").strip()
    if not design:
        raise ValueError("no voice: give refAudio or design")
    if design not in design_refs:
        seed(int(req.get("seed", 0)))
        wav = model.generate(text=f"({design}){DESIGN_LINE}")
        path = req["out"] + ".design.wav"
        sf.write(path, np.asarray(wav, dtype=np.float32), rate)
        design_refs[design] = path
    return design_refs[design]


send({"ready": True, "sampleRate": rate})

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    req = {}
    try:
        req = json.loads(line)
        text = " ".join(req["text"].split())
        if not text:
            raise ValueError("nothing to say")
        ref = reference_for(req)
        seed(int(req.get("seed", 0)))
        style = (req.get("style") or "").strip()
        kwargs = {"text": f"({style}){text}" if style else text, "reference_wav_path": ref}
        if req.get("refText"):
            kwargs.update(prompt_wav_path=ref, prompt_text=req["refText"])
        wav = model.generate(**kwargs)
        sf.write(req["out"], np.asarray(wav, dtype=np.float32), rate)
        send({"id": req["id"], "out": req["out"]})
    except Exception as e:  # noqa: BLE001
        send({"id": req.get("id"), "error": f"{type(e).__name__}: {e}"})
