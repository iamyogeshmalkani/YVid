# code-explainer: short explainers drawn in code (HTML / CSS style)

A vertical (9:16) explainer where **every frame is drawn in `scenes.js`** — text, icons, boxes, arrows, charts and UI pieces from the engine. No AI image model. No Perchance. Chrome paints the frames at render time.

Use this when the story is steps, diagrams, product UI, numbers or type-led teaching. For cartoon stills with a cast, use `cartoon-story` instead.

## Make a video

```sh
. ./env.sh
scripts/new-video.sh code-explainer my-topic
# 1. script.md   narration with [#markers] and ## scene ids
# 2. scenes.js   one function per scene; draw with s.text, s.icon, s.box, s.ui, …
node bin/explainroo.js voice videos/my-topic
node bin/explainroo.js check videos/my-topic
node bin/explainroo.js sheet videos/my-topic
node bin/explainroo.js render videos/my-topic
node bin/explainroo.js verify videos/my-topic
```

Read `TEMPLATE.md` before writing. The sample is a 15-second “three steps after you click a link” piece; replace it for your topic.

## Length

About 30 to 75 seconds (80 to 200 words). Short sentences. One clear idea per scene.
