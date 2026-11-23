# cartoon-story: rules for writing a video with this template

For a coding agent (Claude Code and others) or a person. `AGENTS.md` in the explainroo folder has the general rules; `README.md` here
has the steps and the commands; `REFERENCE.md` has the measurements of the five reference shorts this template copies. This file has
the rules that make it look and sound like them.

The format in one line: a black 9:16 frame, a fixed hook title, a square cartoon picture that changes on almost every phrase (a hard
cut about once a second, no camera move), one spoken word at a time in the middle of the picture, a deep fast voice over a soft music bed.

## 1. Pick the formula, then write the narration

Pick one of the five formulas in `REFERENCE.md` ("The scripts"): **list** (types of people, habits, signs), **fable** (animals or
people, a rule, a crossing, a moral), **belief or topic explainer** (start from its most surprising claim), **"why" history** (three
contrasts, then necessity), **big number** (the number, then a test that grows until it fails). Then:

- **The first sentence is the hook.** No greeting, no "in this video". A number with a stand ("3 kinds of friends are worth keeping
  forever"), an "Imagine believing...", a rule ("never go past the rocks"), a "Why is...?" question, or "This is how many...".
- **Short sentences**, 4 to 14 words. Contractions. "You" and "I". One question as a hinge ("Sounds unbelievable?", "And what did
  she find there?"). Repetition is allowed when it carries rhythm ("the same water, the same rocks, the same fear").
- **Every phrase must be picturable.** A picture lasts about 3 words. Write concrete moments: "you call him at two in the morning, and
  he is already putting on his shoes" is four pictures; "he is reliable" is none.
- **List items start with "Number one."** on its own, then a 2 to 4 word label. `plan-shots.mjs` turns "Number one." into a number
  card by itself.
- **Name each character with one word** and keep it ("the young fish", "the elder"). The picture model and the viewer both lose a
  character who is called three things.
- **End with one line to the viewer**: an order with a reason, a moral in two short lines, a callback to the hook, or a question with a
  "follow me".
- **Length**: 30 to 60 seconds (95 to 200 words at this pace); the references run 28 to 91 s.
- **Facts**: never invent a number, a date or a claim. Explainers and number videos need a source for each fact; if you cannot check
  it, leave it out. Opinion lists and fables need no sources but must not attack real, named people.
- explainroo's own writing rules (AGENTS.md: no colon reveals, no "not X but Y") are relaxed here, because the references use "Not a
  symbol. Not a metaphor." and "Not because they died, but because..." on purpose. Use such a turn once per video at most.

## 2. The title

`TITLE` in shots.js, shown the whole video above the picture. 2 to 8 words, one or two lines of at most about 22 characters, capitals,
the hook words between `*stars*` (yellow). Reword the hook; do not copy the first sentence: "AVOID THESE PEOPLE AT *ALL COSTS*",
"YOU ARE *TRAPPED!*", "*CATHOLICISM* EXPLAINED", "HOW MANY POSITIONS CAN A *CHESSBOARD* HAVE?".

## 3. The cast and the mascot (`CAST` in shots.js)

- **`me` is the narrator mascot.** Keep one look for the whole channel. Use it for every "I", for reactions, for lines spoken to the
  viewer ("you"), and for the last picture (pointing at the viewer, waving, sitting with the topic's object). About one picture in five
  to eight.
- **Every person who appears in more than one picture is a CAST entry**, written once with every field (`noun`, `short`, `age`,
  `height` as a number, `build`, `face`, `hair`, `outfit`). One outfit per key. Never describe a cast member by hand in a shot; write
  `{key}`. `check-shots.mjs` stops "a young guy", "the friend", "a woman" in an action; for a crowd or a person seen once add
  `extras: true`, and use `{crowd}` (simple round-headed bald people) for crowds.
- At most 2 characters in a picture, 3 at the very most.
- Animals or objects that come back (the orange fish, the elder fish) go in CAST too, with `noun: 'small orange fish'` and so on.
- Run `shot-images.mjs --characters --perchance` and look at `assets/char-<key>.png` before any shot is made.

## 4. The shots

`node scripts/plan-shots.mjs <project>` cuts the narration after `voice`: about 0.9 s a picture at `PACE = 'fast'` (0.55 to 1.3 s),
1.6 s at `'calm'` (1.0 to 2.6 s); on the first sound of a word; preferably so the new picture lands on a noun or a verb; at sentence
ends when one is near; "Number one." always alone as a card. Do not edit `word` and `says` by hand: change the script and plan again.

For each shot read its `says`, the shot before and after, and the whole script. Then fill:

1. **`action`: what the viewer SEES with the sound off.** One moment, one verb, the **noun of `says` in view**, under about 35 words,
   `{keys}` for characters and sets. `check-shots.mjs` lists narration words a picture never mentions.
2. **Picture the word literally.** A feeling is a face ("cringe": two people pulling a cringe face). An abstract idea is a physical
   metaphor: self-doubt = a rain cloud over a head; limits = a bird in a cage of stones; protect = a glowing shield; time passing = an
   hourglass, a clock, calendar pages flying; a lot of something = a crowd, a pile, a field of it; nothing = an empty calendar, a wilted
   plant; worldwide = a globe; an idea = a light bulb or a thought cloud.
3. **Function words get the next idea's picture.** A shot that says "and I stay away from" shows the staying away, not "and".
4. **The same subject twice in a row needs a new distance or pose**: wide, then close-up, then from behind. `check-shots.mjs` warns
   about neighbours with the same people, the same place and the same shot size.
5. **`shot` size**: close-up for a face or a reaction, medium shot for people doing something, wide shot for a place, a crowd or a
   distance, extreme close-up for a hand or an object, top-down view for a layout.
6. **`mood` holds the feeling AND the light and palette.** Use the palette to carry the story: murky grey-green while someone is
   stuck, bright and saturated once they are free; cold blue night for worry, warm lamp light for comfort.
7. **Marks**: `mark: 'cross'` for "not this" (a round red badge with a white X, top right corner of the picture), `mark: 'check'` for "this one" (a green badge with a white tick). The kit
   draws them, bouncing in at the cut and clear of faces and the caption; never ask the model for an X or a tick.
8. **`border: true`** on one or two punchlines (the cream snapshot frame of the references).
9. **Splits**: `split: [a, b]` instead of a picture for "those two things", "before and after": the left half of shot a's picture next
   to the right half of shot b's. Pick two pictures whose subjects sit on the outer halves.
10. **No text, numbers or logos in pictures.** The model cannot draw them; the caption shows every word anyway. A question mark or a
    light bulb is fine.
11. **Keep the middle of the picture calm.** The caption sits at the exact center; a face right behind it is fine (it has an edge),
    but avoid a busy pattern there.

After writing: `node scripts/check-shots.mjs <project>` (fix every error, read every warning), then read `storyboard.md` top to
bottom as a viewer: words, then picture.

## 5. Pictures

`LOOK.jpg` shows the look this template gets from Perchance (eight `cozy` pictures, two `inkwash`), made while matching it against
the references. What the prompts ask for, from the references: characters with **thick even black outlines, flat peach skin,
oversized round heads, tiny solid black dot eyes, heavy angled eyebrows, a small nose and round pink blush**; backgrounds in thin
sketchy pencil lines and faded watercolor (sage, beige, dusty blue, warm brown), softer and paler than the characters; no paper
border. The character style is put first in the prompt and only into pictures that have someone in them (`who`, `extras: true`, or
`alive: true` for animals that are not in CAST); a picture of only objects says "no people, no characters, no animals", because
otherwise the model adds little creatures.


- **Frame close.** The references fill the square with the subject: a head and chest, a face, two people at a table. Prefer
  `medium close-up` and `close-up` for people and say it in the action ("his face fills the picture"); keep `wide shot` for places,
  crowds and distances.
- **Shocked or surprised faces** often come back with big white eyes instead of dot eyes (seen in 3 of 4 tries). Remake those, or
  describe the shock with the eyebrows and the mouth ("eyebrows shot up, mouth wide open") rather than the eyes.
- **Paper borders** (a white or cream torn sheet around a smaller picture) are cut off by `scripts/trim-borders.mjs`, which
  `shot-images.mjs` runs after every batch; run it yourself on pictures you add by hand.
- 60 to 70 pictures for a minute at `fast`, 35 to 40 at `calm`. Perchance with 12 tabs makes about 12 in 2 to 3 minutes.
- Make the cast first, then the shots. Keep one look (`LOOK = 'cozy'` or `'inkwash'`) and one maker for the whole video.
- `node scripts/storyboard.mjs <project>` shows every picture with its words; `--who me` shows only the mascot's pictures. Remake a
  picture that drifts (another hair color, an extra finger, text in it): delete `assets/shotNN.*`, run `shot-images.mjs --perchance --only NN`.

## 5b. The verification stage (do it before every render)

Make the cast first and look at `assets/char-<key>.png` (a crocodile or other animal needs a `pose` so it is not drawn standing up like a
person). Make the pictures, then run `scripts/verify-shots.mjs` (see README): each cast member gets a sheet of all its pictures next to its
REF picture, and every picture gets a verdict. Check, in this order: **words** (the noun is in view), **who** (no extra person or creature,
no second crocodile), **same** (face, hair, outfit, skin as REF), **body** (the same weight and build as REF, no belly on a slim character,
no fat crocodile, and the height ratios of CAST), **eyes** (the eyes CAST describes, exactly two, the same size), **anatomy**, **clean**.
Do not accept "close enough" for a main character: remake it, and if the same fault comes back, strengthen the CAST words. `--gate` must
pass before `render`.

## 6. Sound and settings

- Voice: Kokoro `am_michael` at `speed` 1.15 (about 190 words a minute, close to the references' 200). `am_onyx` is deeper; try
  both with `explainroo say`. For Hindi see README.
- Music: `warm` at volume 0.3, under the whole video. `sfx: "minimal"` (only the soft whoosh of a number card).
- `camera: "still"`, `transition: "cut"`, `captions: false` (the kit draws the one-word caption), `watermark: false`.
- `CAPTION.case`: `'upper'` (default) or `'asis'`. `BADGE`: a small round channel avatar in the corner of the picture, or `null`.
