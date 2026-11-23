# Pictures in YVid

YVid supports **only** these two ways to make what appears on screen.

| Template | Method |
|---|---|
| `cartoon-story` | Perchance AI stills |
| `code-explainer` | Code in `scenes.js` (no image model) |

## 1. Perchance (AI stills) — for `cartoon-story`

Free. No API key. Needs Google Chrome open on this Mac.

```bash
. ./env.sh
# cartoon-story project:
node videos/<name>/scripts/shot-images.mjs videos/<name> --characters --perchance
node videos/<name>/scripts/shot-images.mjs videos/<name> --perchance
```

On some Macs set a visible Chrome first:

```bash
export EXPLAINROO_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

Without `--perchance`, `shot-images.mjs` only writes `prompts.md` (paste-ready prompts).

One-off illustration:

```bash
node bin/explainroo.js image videos/<name> my-shot "a concrete scene..." --model perchance --aspect 1:1
```

Open every PNG in `assets/` and remake bad ones with `--only`.

## 2. Code (HTML / CSS-style)

No image model. The coding agent writes `scenes.js` using the engine’s layout,
text, icons, shapes and `s.ui` helpers (cards, buttons, fields). Chrome draws
the frames at render time. Use this for diagrams, product UI, charts and type-led
explainers, or when the user does not want AI pictures.

See `AGENTS.md` (drawing / UI sections).

## Do not use

Local mflux, Cloudflare Workers AI and Pollinations are **not** part of YVid’s
workflow. Do not ask the user for those keys or install those backends.
