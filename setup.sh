#!/bin/sh
# One-time setup. Run from the YVid folder:  sh setup.sh
set -e
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Install Node.js 20 or newer first (https://nodejs.org), then run this again."; exit 1; }
[ -d "/Applications/Google Chrome.app" ] || echo "Note: frames are drawn with Google Chrome; install it from https://www.google.com/chrome/"
echo "1/3  dependencies"
npm install
echo "2/3  ffmpeg and ffprobe"
(cd tools && npm install)
echo "3/3  voice and speech-check models (about 400 MB, first time only; slow connections can reset, just run again)"
. ./env.sh
node bin/explainroo.js doctor --fetch || true
echo
echo "Done. In each new terminal run:   . ./env.sh"
echo "Studio:  node ui/server.mjs   →  http://127.0.0.1:4747"
echo "Or:      scripts/new-video.sh cartoon-story <name>"
echo "         scripts/new-video.sh code-explainer <name>"
echo "See README.md."
