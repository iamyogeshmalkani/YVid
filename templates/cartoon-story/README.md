# cartoon-story: fast cartoon shorts with a new picture on every phrase

Every `CAST` entry needs a `weight` (with height, build, face, hair, outfit). The prompts and `scripts/trim-borders.mjs` also fight stray black lines and edge bars. Every picture with a cast member says the identity, face, hair, outfit, height, weight and build must stay exactly the same.

A vertical (9:16) short in the format of five reference videos the user supplied (a "4 types of people" list, a fish fable, a
Catholicism explainer, a languages history, a chessboard number; `REFERENCE.md` has what was measured):

- a **black frame** with a fixed **hook title** above a **square cartoon picture** (white ExtraBold capitals, hook words in yellow);
- a **new still picture about every second**, a hard cut on the first sound of a word, **no camera move and no transition**;
- **one spoken word at a time** in small white capitals in the middle of the picture;
- glowing red **number cards** for "Number one.", a round red **X** or green **tick** badge in the top right corner of a picture, a cream **snapshot border** for a
  punchline, and a **split** of two pictures for "two very different things", all drawn by the kit;
- a recurring **narrator mascot** and fixed characters (`CAST`), so the same people look the same in 60 pictures;
- a deep, fast male voice (Kokoro `am_michael` at 1.15) over a soft `warm` music bed.

`LOOK.jpg` shows the picture look (made with Perchance from this template's prompts and compared side by side with the references).
Read `TEMPLATE.md` before writing: it has the five script formulas and the rules for the pictures.

## Make a video

```sh
. ./env.sh                                              # from the repository root, once per terminal
cd explainroo
scripts/new-video.sh cartoon-story my-short            # copies this template to videos/my-short
# 1. script.md   the narration, one scene "## story" (30 to 60 s; list items start with "Number one.")
# 2. shots.js    TITLE, PACE ('fast' or 'calm'), LOOK ('cozy' or 'inkwash'), CAST (the mascot "me" + recurring people), SETS
node bin/explainroo.js voice videos/my-short
node videos/my-short/scripts/plan-shots.mjs videos/my-short        # cuts the narration into ~1 s shots, number cards included
# 3. write every "TODO" shot in shots.js (who / shot / set / mood / action, see TEMPLATE.md); scripts/set-shots.mjs fills many at once
node videos/my-short/scripts/check-shots.mjs videos/my-short       # errors and warnings, and storyboard.md
node videos/my-short/scripts/shot-images.mjs videos/my-short --characters --perchance   # look at the cast first: assets/char-<key>.png
node videos/my-short/scripts/shot-images.mjs videos/my-short --perchance                # the pictures (12 tabs; --tabs N)
node videos/my-short/scripts/verify-shots.mjs videos/my-short                          # VERIFY every picture (sheets, --ok, --bad, --remake, --gate), see below
node videos/my-short/scripts/storyboard.mjs videos/my-short                             # pictures with their words: do they match?
node videos/my-short/scripts/storyboard.mjs videos/my-short --who me                    # the mascot in every picture: the same?
node bin/explainroo.js check videos/my-short && node bin/explainroo.js render videos/my-short && node bin/explainroo.js verify videos/my-short
```

The sample (`script.md` and the shots in `shots.js`) is a 35 second list, "3 friends worth keeping", with all 37 shots planned and
written (34 pictures, 3 number cards), so `check-shots.mjs` passes on a fresh copy after `voice`. No pictures come with it: until a
picture exists, its shot shows a grey card with the shot number and what it should show.

If you change the voice, the speed or a sentence, run `plan-shots.mjs` again: shots whose words did not change keep what you wrote
(a split follows its two shots to their new numbers); only new shots get a `TODO`. Pictures are named `shot01.png` ... by number: when
shots move, delete the pictures of the changed shots (`storyboard.md` lists each number's words) and make them again with `--only`.

**Pictures: Perchance only** (free, no key). Needs a visible Chrome: set
`EXPLAINROO_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
and keep that window open. Do not use `--local`, `--cloudflare` or `--pollinations`.
Without `--perchance`, `shot-images.mjs` only writes `prompts.md`, one paste-ready
prompt per picture (square, 1:1). For non-AI frames, draw in `scenes.js` with code
(HTML/CSS-style layout) instead of `shot-images.mjs`.

## Verify every picture before you render

`scripts/verify-shots.mjs` is the verification stage. It builds one contact sheet per cast member (the cast picture `char-<key>` first,
marked REF, then every shot with that character) and one for the object pictures, in `out/verify/`. Look at each tile against the
checklist at the top of the script: the picture shows its words, only the characters in `who` and nobody else, the same face, hair and
outfit as REF, the same **body weight and height** as REF and the numbers in CAST (a slim crocodile stays slim), the right **eyes**,
sound anatomy, and nothing clean-looking is spoiled by text, black bars or borders. Then write the verdicts and remake the bad ones:

```sh
node videos/my-short/scripts/verify-shots.mjs videos/my-short                          # sheets + what is still to check
node videos/my-short/scripts/verify-shots.mjs videos/my-short --ok 1-8,10,12           # good pictures
node videos/my-short/scripts/verify-shots.mjs videos/my-short --bad 9:two crocodiles --bad 14:croc is fat
node videos/my-short/scripts/verify-shots.mjs videos/my-short --remake                 # delete + make again (Perchance, 12 tabs)
node videos/my-short/scripts/verify-shots.mjs videos/my-short --gate                   # exit 1 until EVERY picture is ok
```

A remade picture loses its verdict, so it is checked again; repeat until `--gate` passes, then render. `verify.json` keeps the verdicts and
`verify-history.md` the reasons of every remake. A reason that repeats (the crocodile is fat again) means the CAST words are too weak:
strengthen `weight`, `build` or `face` in `shots.js` and remake every picture of that character.

## Two paces

| `PACE` | A picture lasts | Pictures a minute | Like |
|---|---|---|---|
| `'fast'` (default) | 0.55 to 1.3 s, about 0.9 | 60 to 70 | the list, the fable, the explainer |
| `'calm'` | 1.0 to 2.6 s, about 1.6 | 35 to 40 | the languages history, the chessboard number |

## Hindi

Set `"language": "hi"` and a Hindi voice in `video.json` (Kokoro `hm_omega` or `hm_psi` for a male voice, or F5 with a cloned voice:
see "Hindi voice with voice cloning" in `AGENTS.md`), and `CAPTION.case = 'asis'`. The captions fall back to Noto Sans Devanagari.
"नंबर एक।" becomes a number card like "Number one." does. For captions in Roman letters with a Hindi voice, write pairs
(`Number ek || नंबर एक`) and run `node scripts/pairs-to-script.mjs videos/my-short pairs.txt`. Picture prompts stay in English.

## The kit (`lib/kit.js`)

| Call | What it draws |
|---|---|
| `pictureBand(s)` | the square picture area: full width, from 21.9% of the height |
| `shots(s, SHOTS, { band, fileOf, push })` | the pictures (hard cuts on their word), number cards, splits, marks and borders; `push: 0.03` adds a slow 3% push (the references have none) |
| `title(s, TITLE)` | the hook title above the picture, `*starred*` words yellow |
| `wordCaption(s, CAPTION, band)` | one spoken word at a time; a number keeps its unit ("8 BILLION") |
| `badge(s, 'assets/badge.png', band)` | a small round channel avatar in the lower right corner of the picture |

## Limits (read before promising anything)

- The pictures come from text only, so a character looks **similar, not identical**, from picture to picture. CAST, the size numbers
  and the check keep it close; look at every picture (`storyboard.mjs --who`) and remake the ones that drift.
- A minute needs 60 to 70 pictures. Expect to remake 5 to 10 of them (extra fingers, text-like marks, a wrong prop, big white
  eyes on a shocked face instead of dot eyes). Paper borders are cut off automatically (`scripts/trim-borders.mjs`).
- The picture model cannot draw words or numbers; the caption shows them.
- The layout, timing and caption sizes were measured from the references. The voice choice, the music style and the loudness of the
  music were chosen to match measurements (pitch, words a minute, music about 10 dB under the voice), but nobody has listened to a
  video made with this template yet.
