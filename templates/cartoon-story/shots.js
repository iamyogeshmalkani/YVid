// cartoon-story: the shot list of a fast cartoon short. This file holds
//   1. the LAYOUT settings: title, pace, caption case,
//   2. the STYLE: every picture shares one cartoon look,
//   3. the CAST: the narrator mascot and every recurring character, written ONCE (age, height, build, face, hair, outfit),
//   4. the SETS: recurring places and recurring things (a crowd, a symbol), written once,
//   5. the SHOTS: one picture each, about 1 second long, planned from the narration by scripts/plan-shots.mjs,
//   6. promptFor(): builds the picture prompt from the pieces above.
//
// THE FORMAT (measured from five reference shorts, see REFERENCE.md): a black 9:16 frame, a fixed bold title above a SQUARE
// picture, ONE spoken word at a time in small white capitals in the middle of the picture, and a NEW still picture on almost every
// phrase: a hard cut every 0.6 to 1.3 seconds, on the first sound of a word. The pictures do not move; the cutting is the motion.
//
// WHAT A SHOT SAYS (scripts/check-shots.mjs reports what is missing):
//   n       the number (shot-images.mjs --only 3,5)
//   word    the index of the first narration word of the shot (0 = the first word). Written by plan-shots.mjs.
//   says    the narration words of this shot, copied by plan-shots.mjs. The picture must SHOW what these words say.
//   A picture shot:
//     who     keys of CAST in the picture (at most 2, 3 at the very most). Every one must appear as {key} in `action`.
//     shot    'close-up' | 'medium close-up' | 'medium shot' | 'wide shot' | 'extreme close-up' | 'top-down view' | 'low angle shot' | 'over-the-shoulder shot'
//     action  what the viewer SEES: who does what, to what, where, with {keys}. One moment, one verb, the noun of `says` in view.
//     set     where: a key of SETS or a few words. Keep the same key for the same place.
//     mood    the feeling AND the light/palette ('gloomy, murky grey-green light' / 'joyful, bright turquoise water').
//     extras  true when the picture has people who are not in CAST (a crowd, a cab driver who is seen once).
//     alive   true when the picture has animals that are not in CAST (a school of fish), so they get the cartoon face style.
//     mark    'cross' (a round red X badge in the corner: "not this") or 'check' (a round green tick badge: "this one"), drawn by the kit, not by the model.
//     border  true: a thin cream photo border (the "snapshot" accent of the references; use it for 1 or 2 punchlines per video).
//   A number card ("Number two."): { card: 2 }   drawn by the kit (glowing red slash marks on a dark wall); no picture needed.
//   A split ("those two very different things"): { split: [12, 40] }  the left half of shot 12's picture next to the right half of
//                                                 shot 40's picture, with a black seam; no new picture needed.
//
//   node scripts/plan-shots.mjs <project>      after `voice`: cuts the narration into shots, keeps what you wrote
//   node scripts/check-shots.mjs <project>     lint: characters, words, durations, and storyboard.md (says next to the picture prompt)
//   node scripts/shot-images.mjs <project>     prompts.md, or --perchance (12 tabs), --characters first to look at the cast
//   node scripts/storyboard.mjs <project>      a sheet of the pictures with the narration under each

// ---------- the layout ----------
// The title stays on screen the whole video, above the picture. One or two short lines; *starred* words are yellow.
// Write it as a hook, not as the first sentence: "AVOID THESE PEOPLE AT ALL COSTS", "YOU ARE *TRAPPED!*".
export const TITLE = { lines: ['3 FRIENDS WORTH', 'KEEPING *FOREVER*'] };
// 'fast' = a picture every 0.55 to 1.3 seconds (about 3 words, 60 to 70 pictures a minute; stories, lists, explainers)
// 'calm' = a picture every 1.0 to 2.6 seconds (about 5 words, 35 to 40 pictures a minute; one big idea, a number, a "why" history)
export const PACE = 'fast';
// The caption: one word at a time. 'upper' = capitals (most references), 'asis' = as written (the languages reference).
export const CAPTION = { case: 'upper', size: 0.036, y: 0.5 };
// An optional small round badge (your channel avatar) in the lower right corner of the picture: 'assets/badge.png', or null.
export const BADGE = null;

// ---------- the look ----------
// One look per video. 'cozy' is the look of four of the references (people, fish, chess, religion); 'inkwash' is the
// look of the languages reference (sepia stick figures on paper); 'parchment' is the look of the Crocodile Paradox short (round-headed
// stick figures, painted animals, hazy sepia watercolor riverside).
export const LOOK = 'cozy';
// head: the first words of every prompt. people: how every person or animal is drawn (only in pictures that have one).
// scene: how the rest is drawn. empty: added to pictures with nobody in `who` and no `extras`, so the model adds no one.
const LOOKS = {
  cozy: {
    head: 'Cozy hand-drawn cartoon illustration, modern storybook webcomic style, full-bleed edge to edge,',
    people: 'every person or animal is drawn as a cute cartoon with an oversized round head, flat warm peach skin, tiny solid black oval dot eyes with no white in them even when surprised, thick dark angled eyebrows, a small rounded nose, round pink blush circles on the cheeks, simple chunky hands, thick smooth even black outlines and flat soft colors',
    scene: 'the background drawn with thin sketchy ink and pencil lines and faded watercolor washes, slightly soft and out of focus, muted desaturated palette of sage green, beige, dusty blue and warm brown, cozy lived-in details, soft diffused window light, clean finish, square 1:1, the subject large and close in the center, clean smooth finish with no stray marks, no black lines, no scratches, no dark streaks, no black bars or dark edge lines anywhere in the picture, no paper border, no frame, no text, no letters, no words, no numbers, no logos',
    empty: 'no people, no characters, no animals',
    negative: 'photo, realistic, 3d render, cgi, anime, manga, big shiny eyes, text, letters, words, numbers, watermark, logo, signature, blurry, extra fingers, deformed hands, two heads, frame, border, torn paper edge, stray black lines, thin black lines, black marks, black dashes, scratches, dark streaks, black bars, black edge line, line artifacts, glitch, noise, different face, changed outfit, inconsistent character',
    figure: 'a cartoon',
  },
  inkwash: {
    head: 'Simple hand-drawn ink illustration on warm beige paper, full-bleed edge to edge,',
    people: 'every person is a minimalist stick figure with a big perfectly round pale beige-peach head, two small black dot eyes, short eyebrows, a few loose hair strands, thin black stick arms and legs, wearing simple draped cloth, the figure large in the picture',
    scene: 'thin black ink outlines, light pencil hatching, soft muted watercolor washes of sepia, olive green, sand and slate grey, a sparse landscape with lots of empty paper, gentle naive storybook mood, square 1:1, the subject in the center, clean smooth finish with no stray marks, no black lines, no scratches, no dark streaks, no black bars or dark edge lines anywhere in the picture, no paper border, no frame, no text, no letters, no words, no numbers',
    empty: 'no people, no figures',
    negative: 'photo, realistic, 3d render, anime, bold saturated colors, text, letters, words, numbers, watermark, logo, signature, blurry, frame, border, torn paper edge, stray black lines, thin black lines, black marks, black dashes, scratches, dark streaks, black bars, black edge line, line artifacts, glitch, noise, different face, changed outfit, inconsistent character',
    figure: 'a stick figure of',
  },
  parchment: {
    head: 'Minimalist hand-drawn storybook illustration, sepia watercolor and thin ink webcomic style on warm cream parchment paper, full-bleed edge to edge,',
    people: 'every person is a minimalist stick figure: a big perfectly round plain white head with no ears and no nose, two small solid black dot eyes, short angled eyebrows, thin black line arms and legs like a stick man, and a short plain brown or olive tunic that stops at the hips; only the named characters appear and no other animals or creatures',
    scene: 'the background painted in soft hazy sepia, olive green, sand and dusty grey-blue watercolor washes with thin sketchy ink lines, a calm sparse medieval riverside landscape with plenty of empty paper, clean uncluttered composition, the subjects large, square 1:1, clean smooth finish with no stray marks, no black lines, no scratches, no dark streaks, no black bars or dark edge lines anywhere in the picture, no small animals in the background, no paper border, no frame, no title, no text, no letters, no words, no numbers, no logos',
    empty: 'no people, no stick figures, no characters, no animals',
    negative: 'photo, realistic, 3d render, cgi, anime, manga, bold saturated colors, big shiny eyes, text, letters, words, title, numbers, watermark, logo, signature, blurry, extra fingers, deformed hands, frame, border, torn paper edge, stray black lines, thin black lines, black marks, black dashes, scratches, dark streaks, black bars, black edge line, line artifacts, glitch, noise, different face, changed outfit, inconsistent character',
    figure: 'a',
  },
};
export const STYLE_HEAD = LOOKS[LOOK].head;
export const STYLE_TAIL = `${LOOKS[LOOK].people}; ${LOOKS[LOOK].scene}`;
export const NEGATIVE = LOOKS[LOOK].negative;
export const ASPECT = '1:1';

// ---------- the cast ----------
// `me` is the narrator mascot: the one who says "I", reacts ("Sounds unbelievable?"), points at the viewer and closes the video.
// Make it your own (hair, shirt color) and keep it the same in every video of the channel.
// height: a number, 1 = the tallest grown-up of the video. A child is about 0.5 to 0.6, a teenager 0.8, a short adult 0.9.
// Optional `pose`: how the portrait char-<key> is drawn (an animal: 'seen from the side, walking on all four legs, NOT standing on its hind legs'); default 'standing, facing the camera'.
// Say the body weight in `weight` AND `build` in plain words ('slim and lean, no belly', 'heavy and solid'); the verification stage checks it in every picture.
// Write every field. Do not use words that change between pictures ("young", "old", "guy") anywhere but here.
export const CAST = {
  me: {
    noun: 'young man', short: 'the narrator', age: 'about 25 years old', height: 1,
    weight: 'slim, light', build: 'slim, medium height', face: 'round face, warm brown skin, thick black eyebrows, small dot eyes, rosy cheeks',
    hair: 'big thick curly black hair', outfit: 'a sage-green button-up shirt with the sleeves rolled up and dark grey trousers',
  },
  loyal: {
    noun: 'young man', short: 'the loyal friend', age: 'about 25 years old', height: 0.95,
    weight: 'heavy, solid', build: 'broad and sturdy', face: 'square face, light skin, a big friendly grin, freckles',
    hair: 'short spiky ginger hair', outfit: 'a mustard-yellow hoodie and blue jeans',
  },
  honest: {
    noun: 'young woman', short: 'the honest friend', age: 'about 25 years old', height: 0.9,
    weight: 'slim, light', build: 'slim', face: 'oval face, tan skin, calm serious eyes, round glasses',
    hair: 'a black bob haircut', outfit: 'a red turtleneck sweater and a brown skirt',
  },
  cheer: {
    noun: 'young man', short: 'the cheering friend', age: 'about 25 years old', height: 0.92,
    weight: 'very thin, light', build: 'thin and lanky', face: 'long face, dark skin, a wide open smile, bright eyes',
    hair: 'short black twists', outfit: 'a purple t-shirt, white sneakers and a blue cap',
  },
};

// ---------- the sets ----------
// A place, or a thing that comes back (a crowd, a symbol), written once here; use it as set: 'room' or {room} in an action.
export const SETS = {
  room: 'a cozy small apartment living room with wooden bookshelves, potted plants and a big bright window',
  cafe: 'a quiet cafe corner with a wooden table, two mugs and plants by the window',
  street: 'a calm city street with bare trees and old brick houses, soft overcast light',
  crowd: 'a crowd of small round-headed bald cartoon people with dot eyes and pink blush, all alike',
};

// ---------- the shots ----------
// <SHOTS> generated by scripts/plan-shots.mjs: it rewrites everything down to </SHOTS> and keeps the scenes you wrote
// for lines of the narration that did not change.
export const SHOTS = [
  { n: 1, word: 0,
    says: "Three kinds of friends",
    who: ["loyal","honest","cheer"], shot: "medium shot", set: "a soft golden glowing background", mood: "warm, hopeful, golden light",
    action: "three different kinds of company: {loyal}, {honest} and {cheer} stand side by side with their arms around each other, smiling at the viewer" },
  { n: 2, word: 4,
    says: "are worth keeping",
    who: ["me"], shot: "close-up", set: "room", mood: "warm, protective",
    action: "{me} hugs a small glowing golden treasure chest tight against his chest with both arms, eyes closed, keeping it safe" },
  { n: 3, word: 7,
    says: "forever.",
    who: [], shot: "close-up", set: "room", mood: "calm, timeless, soft golden light",
    action: "a tall wooden hourglass on a bookshelf with glowing golden sand that keeps falling forever" },
  { n: 4, word: 8,
    says: "If you have even one,",
    who: ["me"], shot: "medium shot", set: "room", mood: "serious, warm daylight",
    action: "{me} holds up one finger and raises his thick eyebrows, looking straight at the viewer" },
  { n: 5, word: 13,
    says: "never let them go.",
    who: ["me","loyal"], shot: "close-up", set: "room", mood: "determined, warm",
    action: "{me} grips the hand of {loyal} tightly with both hands and refuses to let go, a determined face" },
  { n: 6, word: 17, card: 1,
    says: "Number one." },
  { n: 7, word: 19,
    says: "The friend who",
    who: ["loyal"], shot: "medium shot", set: "the open front door of a small apartment at night, warm hallway light", mood: "friendly, reassuring",
    action: "{loyal} stands in the open front door at night with a friendly grin, one hand raised in a wave" },
  { n: 8, word: 22,
    says: "shows up.",
    who: ["loyal"], shot: "wide shot", set: "the open front door of a small apartment at night, warm hallway light", mood: "urgent, warm",
    action: "{loyal} shows up out of breath at the door with a bag of snacks, ready to help" },
  { n: 9, word: 24,
    says: "You call him at two in the",
    who: ["me"], shot: "medium shot", set: "a dark bedroom at night, blue moonlight through the window", mood: "worried, lonely, dark blue night",
    action: "{me} sits on the edge of his bed in the dark and holds a glowing phone to his ear, a worried face, about to call" },
  { n: 10, word: 31,
    says: "morning, and he is",
    who: [], shot: "close-up", set: "a dark bedroom at night", mood: "quiet, dark blue night",
    action: "a round wall clock with a plain face and no numbers, its hands pointing at two o'clock in the morning, lit by moonlight" },
  { n: 11, word: 35,
    says: "already putting on his",
    who: ["loyal"], shot: "medium shot", set: "a messy bedroom at night, a lamp just switched on", mood: "rushed, warm lamp light",
    action: "{loyal} in striped pajamas sits on his bed with a phone pinched between ear and shoulder, already putting on a sneaker" },
  { n: 12, word: 39,
    says: "shoes.",
    who: ["loyal"], shot: "extreme close-up", set: "a bedroom floor at night", mood: "hurried",
    action: "the hands of {loyal} quickly tie the laces of red shoes, in a hurry" },
  { n: 13, word: 40,
    says: "He does not ask",
    who: ["loyal"], shot: "medium shot", set: "a small hallway at night", mood: "calm, decided",
    action: "{loyal} grabs his car keys from a hook without a second thought, he does not ask a single question" },
  { n: 14, word: 44,
    says: "why.",
    who: ["me"], shot: "close-up", set: "a dark bedroom at night, blue moonlight", mood: "surprised, touched",
    action: "{me} blinks in surprise with the phone at his ear, a small question mark floating over his head, wondering why" },
  { n: 15, word: 45,
    says: "He just comes.",
    who: ["loyal"], shot: "wide shot", set: "street", mood: "determined, night, warm streetlights",
    action: "{loyal} runs down an empty street at night under warm streetlights, his jacket flapping, he just comes" },
  { n: 16, word: 48, card: 2,
    says: "Number two." },
  { n: 17, word: 50,
    says: "The honest friend.",
    who: ["honest"], shot: "medium shot", set: "room", mood: "calm, honest, soft daylight",
    action: "{honest} stands with her arms crossed and looks straight at the viewer with a calm, honest look" },
  { n: 18, word: 53,
    says: "She tells you the shirt",
    who: ["honest"], shot: "close-up", set: "room", mood: "amused, daylight",
    action: "{honest} holds up an ugly bright orange shirt covered in purple flamingos between two fingers and squints at it" },
  { n: 19, word: 58,
    says: "looks bad before you",
    who: ["honest","me"], shot: "medium shot", set: "room", mood: "funny, daylight",
    action: "{me} holds the flamingo shirt up hopefully while {honest} gives it a thumbs down and a grimace, it looks bad" },
  { n: 20, word: 62,
    says: "leave the house,",
    who: ["me"], shot: "medium shot", set: "the front door of a cozy apartment, daylight", mood: "cheerful",
    action: "{me} reaches for the handle of the front door, ready to leave the house" },
  { n: 21, word: 65, mark: "cross", extras: true,
    says: "not after.",
    who: [], shot: "wide shot", set: "a bright noisy house party", mood: "embarrassing, loud party colors",
    action: "{crowd} at a party laughing and pointing at someone just outside the picture" },
  { n: 22, word: 67,
    says: "It stings for a",
    who: ["me"], shot: "close-up", set: "room", mood: "ouch, comic",
    action: "{me} winces with one eye shut, a tiny cartoon arrow stuck in his shirt, it stings" },
  { n: 23, word: 71,
    says: "minute and saves you for",
    who: ["honest","me"], shot: "medium shot", set: "room", mood: "relieved, warm",
    action: "{honest} pats {me} on the shoulder while he smiles with relief, a soft glowing shield around them that saves him" },
  { n: 24, word: 76,
    says: "years.",
    who: [], shot: "wide shot", set: "a wooden desk by a window", mood: "time passing, golden afternoon light",
    action: "blank calendar pages fly off a wall calendar and swirl away through the air, years passing" },
  { n: 25, word: 77, card: 3,
    says: "Number three." },
  { n: 26, word: 79,
    says: "The friend who cheers the",
    who: ["cheer"], shot: "medium shot", set: "a sunny park with green grass", mood: "joyful, bright sunshine",
    action: "{cheer} jumps high with both arms up and his mouth wide open in a huge cheer" },
  { n: 27, word: 84,
    says: "loudest.",
    who: ["cheer"], shot: "extreme close-up", set: "a sunny park", mood: "loud, joyful, bright",
    action: "{cheer} shouts the loudest through his cupped hands, cartoon sound lines bursting from his mouth" },
  { n: 28, word: 85,
    says: "When you win, he is happier",
    who: ["me","cheer"], shot: "wide shot", set: "a small school stage with red curtains", mood: "triumphant, spotlight",
    action: "{me} lifts a shiny gold trophy over his head to win on a small stage while {cheer} jumps and cheers wildly, happier than anyone" },
  { n: 29, word: 91, border: true,
    says: "than you are.",
    who: ["cheer","me"], shot: "medium shot", set: "a small school stage with red curtains", mood: "funny, warm spotlight",
    action: "{cheer} cries happy tears and hugs the gold trophy, while {me} stands beside him with a small polite smile" },
  { n: 30, word: 94,
    says: "He claps for your",
    who: ["cheer"], shot: "close-up", set: "room", mood: "proud, warm",
    action: "{cheer} claps his hands hard and beams with pride" },
  { n: 31, word: 98,
    says: "smallest wins,",
    who: ["me"], shot: "medium shot", set: "a tiny cozy kitchen", mood: "small proud moment, morning light",
    action: "{me} proudly holds up one perfect cup of coffee with latte art, a small win" },
  { n: 32, word: 100,
    says: "with zero",
    who: ["cheer"], shot: "close-up", set: "room", mood: "sincere, warm",
    action: "{cheer} gives a big honest thumbs up with zero hidden feelings, a wide sincere smile" },
  { n: 33, word: 102, mark: "cross", alive: true,
    says: "jealousy.",
    who: [], shot: "close-up", set: "a dim shelf", mood: "sour, greenish",
    action: "a small grumpy green cartoon monster with narrow jealous eyes sits alone on a shelf, the face of jealousy" },
  { n: 34, word: 103, extras: true,
    says: "Most people never find",
    who: [], shot: "wide shot", set: "a huge empty foggy field at dusk", mood: "lonely, grey-blue fog",
    action: "{crowd} wander through the fog holding small lanterns, searching and never finding" },
  { n: 35, word: 107,
    says: "all three.",
    who: ["loyal","honest","cheer"], shot: "wide shot", set: "room", mood: "warm, cozy evening lamp light",
    action: "{loyal}, {honest} and {cheer} sit together on one sofa laughing, all three of them" },
  { n: 36, word: 109, extras: true,
    says: "If you have them,",
    who: ["me"], shot: "close-up", set: "room", mood: "warm, grateful",
    action: "{me} looks down at his phone with a warm smile, three small round photos of smiling faces glowing on the screen" },
  { n: 37, word: 113,
    says: "call them today.",
    who: ["me"], shot: "medium shot", set: "room", mood: "warm, upbeat daylight",
    action: "{me} holds a phone to his ear to call and points straight at the viewer with a big grin" },
];
// </SHOTS>

// ---------- the prompts ----------
const EXPAND = /\{(\w+)\}/g;
export const fileOf = (shot) => shot.file ?? `shot${String(shot.n).padStart(2, '0')}`;
// a shot that needs a picture of its own (number cards and splits are drawn from other shots)
export const needsPicture = (shot) => shot.card === undefined && !shot.split;

// The full description of a character. Always the same words.
export function describe(key) {
  const c = CAST[key];
  if (!c) throw new Error(`"${key}" is not in CAST (have: ${Object.keys(CAST).join(', ')})`);
  for (const f of ['noun', 'short', 'age', 'height', 'weight', 'build', 'face', 'hair', 'outfit']) if (c[f] === undefined) throw new Error(`CAST.${key} has no "${f}"`);
  return `${LOOKS[LOOK].figure} ${c.noun}, ${c.age}, ${c.weight} body weight, ${c.build}, ${c.face}, ${c.hair}, wearing ${c.outfit}${c.extra ? `, ${c.extra}` : ''}`;
}

// Who is taller than whom, from the numbers in CAST.
export function sizes(keys) {
  const list = [...new Set(keys)].map((k) => ({ k, c: CAST[k] })).filter((x) => x.c).sort((a, b) => b.c.height - a.c.height);
  const out = [];
  for (let i = 1; i < list.length; i++) {
    const tall = list[i - 1].c;
    const small = list[i].c;
    const r = small.height / tall.height;
    const how = r >= 0.92 ? 'about the same height as' : r >= 0.75 ? 'a little shorter than' : r >= 0.6 ? 'clearly shorter than, up to the chest of' : r >= 0.45 ? 'about half as tall as' : 'tiny next to';
    out.push(`${small.short} is ${how} ${tall.short}`);
  }
  return out.length ? `Sizes: ${out.join('; ')}.` : '';
}

// In the action, {key} becomes the character's short name ("the narrator"); the full, always identical description of every
// character in `who` follows in a "Characters:" part. A set key becomes its description.
function expand(text, seen) {
  return String(text).replace(EXPAND, (m, key) => {
    if (CAST[key]) { seen.add(key); return CAST[key].short; }
    if (SETS[key]) return SETS[key];
    throw new Error(`{${key}} is neither in CAST (${Object.keys(CAST).join(', ')}) nor in SETS (${Object.keys(SETS).join(', ')})`);
  });
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// The prompt of one shot: style words, shot size and action, the characters in full, their sizes, the set, the mood, style words.
// Said in every picture that has a cast member: the character is the same person in all pictures.
const CONSISTENT = 'Each character stays exactly the same in every picture of this video: the same identity, the same face and head shape, the same skin tone, the same hair, the same outfit and colors, the same height, the same body weight and build, and the same size relative to the others. Never change, add or swap any of it.';

export function promptFor(shot) {
  if (!needsPicture(shot)) throw new Error(`shot ${shot.n} is a ${shot.card !== undefined ? 'number card' : 'split'}: it has no picture of its own`);
  if (!shot.action || /^TODO/.test(shot.action)) throw new Error(`shot ${shot.n}: the action is not written yet`);
  const seen = new Set();
  const action = expand(shot.action, seen);
  const missing = (shot.who || []).filter((k) => !seen.has(k));
  if (missing.length) throw new Error(`shot ${shot.n}: ${missing.join(', ')} is in "who" but {${missing[0]}} is not in the action`);
  const set = shot.set ? (SETS[shot.set] ? SETS[shot.set] : shot.set) : '';
  const who = [...new Set(shot.who || [])];
  const alive = who.length || shot.extras || shot.alive;
  const parts = [
    STYLE_HEAD,
    // the face and line style comes first: picture models follow the first words most, and late style words lose to the action
    // ("stares in shock" otherwise gets big white eyes)
    alive ? `${LOOKS[LOOK].people}.` : '',
    `${shot.shot || 'medium shot'}: ${cap(action)}.`,
    who.length ? `Characters: ${who.map((k) => `${cap(CAST[k].short)} is ${describe(k)}`).join('. ')}.` : '',
    sizes(who),
    who.length ? CONSISTENT : '',
    set ? `Setting: ${set}.` : '',
    shot.mood ? `Mood and light: ${shot.mood}.` : '',
    // the people style only where there is someone (or something alive) to draw; otherwise the model adds characters by itself
    alive ? '' : `${LOOKS[LOOK].empty};`,
    LOOKS[LOOK].scene,
  ].filter(Boolean);
  return parts.join(' ');
}

// A picture of one character alone on a plain background, to look at before any shot is made (shot-images.mjs --characters).
export function characterPrompt(key) {
  return `${STYLE_HEAD} full body portrait of ONE character alone, ${describe(key)}, ${CAST[key].pose || 'standing, facing the camera'}, calm friendly expression, plain soft beige background, nobody else and no other animals in the picture, ${LOOKS[LOOK].people}; ${LOOKS[LOOK].scene}`;
}
