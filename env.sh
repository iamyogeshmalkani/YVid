# Source this from the YVid folder:   . ./env.sh
ROOT="$PWD"
if [ ! -f "$ROOT/bin/explainroo.js" ]; then echo "run this from the YVid folder (the folder with env.sh)"; return 1 2>/dev/null || exit 1; fi
case "$(uname -m)" in arm64) ARCH=arm64 ;; *) ARCH=x64 ;; esac
export EXPLAINROO_FFMPEG="$ROOT/tools/node_modules/ffmpeg-static/ffmpeg"
export EXPLAINROO_FFPROBE="$ROOT/tools/node_modules/ffprobe-static/bin/darwin/$ARCH/ffprobe"
[ "$ARCH" = arm64 ] && [ -x "$ROOT/tools/node_modules/@ffprobe-installer/darwin-arm64/ffprobe" ] && export EXPLAINROO_FFPROBE="$ROOT/tools/node_modules/@ffprobe-installer/darwin-arm64/ffprobe"
alias explainroo="node $ROOT/bin/explainroo.js"
[ -f "$ROOT/env.local.sh" ] && . "$ROOT/env.local.sh"
if [ -n "$EXPLAINROO_CACHE" ]; then
  mkdir -p "$EXPLAINROO_CACHE" 2>/dev/null && echo "models are kept in $EXPLAINROO_CACHE"
fi
echo "YVid ready (ffmpeg: $EXPLAINROO_FFMPEG)"
