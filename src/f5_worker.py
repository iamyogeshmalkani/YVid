"""Worker for explainroo's Hindi F5 voice (SPRINGLab/F5-Hindi-24KHz, small F5-TTS model).

Started by src/f5.js as:  python -I f5_worker.py <model folder>
Reads one JSON request per line on stdin and answers one JSON line on stdout.
  request : {"id", "text", "refAudio", "refText", "speed", "seed", "out"}
  reply   : {"id", "out"}  or  {"id", "error"}
Everything else (F5 prints a lot) goes to stderr so stdout stays clean.
"""
import json
import os
import sys
import unicodedata

reply = sys.stdout
sys.stdout = sys.stderr  # F5-TTS prints progress with print()

model_dir = sys.argv[1]
root = os.path.dirname(os.path.abspath(model_dir))

import soundfile as sf  # noqa: E402
import torch  # noqa: E402
import torchaudio  # noqa: E402


def _load(path, *args, **kwargs):
    # Newer torchaudio reads files through torchcodec, which needs ffmpeg's shared libraries
    # (not installed here). explainroo gives F5 a plain WAV, so soundfile is enough.
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    return torch.from_numpy(data.T.copy()), sr


torchaudio.load = _load

from f5_tts.api import F5TTS  # noqa: E402

device = os.environ.get("EXPLAINROO_F5_DEVICE") or ("mps" if torch.backends.mps.is_available() else "cpu")
vocab_file = os.path.join(model_dir, "vocab.txt")
with open(vocab_file, encoding="utf8") as f:
    VOCAB = set(line.rstrip("\n") for line in f)
VOCAB.add(" ")

tts = F5TTS(
    model="F5TTS_Small",  # the Hindi model is the "small" configuration (151M parameters)
    ckpt_file=os.path.join(model_dir, "model_2500000.safetensors"),
    vocab_file=vocab_file,
    vocoder_local_path=os.path.join(root, "vocos"),
    device=device,
)


def clean(text):
    """Keep only characters the model knows; anything else would be read as a gap."""
    text = unicodedata.normalize("NFC", text)
    for a, b in (("‘", "'"), ("’", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", ","), ("…", "..."), (" ", " "), ("\n", " ")):
        text = text.replace(a, b)
    return " ".join("".join(c for c in text if c in VOCAB).split())


def send(obj):
    reply.write(json.dumps(obj) + "\n")
    reply.flush()


send({"ready": True, "device": device})

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    req = {}
    try:
        req = json.loads(line)
        text = clean(req["text"])
        if not text:
            raise ValueError("nothing left to say after removing characters the model does not know")
        wav, sr, _ = tts.infer(
            ref_file=req["refAudio"],
            ref_text=req["refText"],
            gen_text=text,
            speed=float(req.get("speed", 1)),
            seed=int(req.get("seed", 0)),
            nfe_step=int(os.environ.get("EXPLAINROO_F5_STEPS", "32")),
            show_info=lambda *a, **k: None,
        )
        sf.write(req["out"], wav, sr)
        send({"id": req["id"], "out": req["out"]})
    except Exception as e:  # noqa: BLE001
        send({"id": req.get("id"), "error": f"{type(e).__name__}: {e}"})
