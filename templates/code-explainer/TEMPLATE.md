# code-explainer: rules for writing a video with this template

For a coding agent. `AGENTS.md` has the general rules; `README.md` has the commands. This file is the style.

The format in one line: a clean paper look, 9:16, narration with `[#markers]`, every picture drawn in `scenes.js` with the engine (no AI stills).

## 1. Narration (`script.md`)

- Hook in the first sentence. No greeting.
- Short sentences. Concrete verbs. One idea per scene.
- Put `[#name]` where something should appear or move.
- Scenes are `## id` blocks; each id must match a function in `scenes.js`.
- Length: about 30 to 75 seconds. Facts must be checkable; never invent numbers.

## 2. Drawing (`scenes.js`)

- One export function per scene. Use `s.text`, `s.title`, `s.subtitle`, `s.icon`, `s.box`, `s.arrow`, `s.number`, `s.row` / `s.col`, and `s.ui` for product chrome.
- Animate with `at: '#marker'` or `at: 'spoken word'` or seconds.
- Keep layout inside `s.safe`. Same places across scenes when the idea continues.
- Prefer icons and type over fake screenshots. No `s.image` of Perchance files in this template.
- One focal point per scene. Answer: what should the viewer look at?

## 3. Settings (`video.json`)

- Theme `paper` (default). Size `9:16` for Shorts/Reels; use `16:9` only if the user asks.
- Captions on. Watermark off unless the user wants it.

## 4. Checks

Run `voice`, then `check`, then `sheet`, then `render`, then `verify`. Fix layout and pronunciation before render.
