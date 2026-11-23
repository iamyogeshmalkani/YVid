// cartoon-story: normally you only edit script.md, shots.js (TITLE, CAST, SETS, SHOTS) and video.json. This file turns the shot
// list into the video. The narration is ONE scene called "story"; the shots are cut from its words, so no markers are needed.
// The kit is in lib/kit.js; the layout it copies is measured in REFERENCE.md.
import { SHOTS, TITLE, CAPTION, BADGE, fileOf } from './shots.js';
import { pictureBand, shots, title, wordCaption, badge } from './lib/kit.js';

export default {
  story(s) {
    const band = pictureBand(s);          // a square picture between the title and the empty black foot
    shots(s, SHOTS, { band, fileOf });     // a new still picture on every phrase, hard cuts, number cards, splits, marks
    title(s, TITLE);                       // the hook title above the picture, the whole video
    badge(s, BADGE, band);                 // optional channel avatar in the corner of the picture
    wordCaption(s, CAPTION, band);         // one spoken word at a time in the middle of the picture
  },
};
