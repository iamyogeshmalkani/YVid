# YVid

Short **cartoon story** videos made by your AI coding agent.

Free and open source. Voice, timing and rendering run on your computer.
Built on [explainroo](https://github.com/vincentsch/explainroo) (MIT).

## Make a video

Copy this into Claude Code, Codex, Cursor, or any coding agent, and put your topic in place of the brackets:

```text
Make me a short cartoon story video about [your topic].
Use YVid for it: clone https://github.com/iamyogeshmalkani/YVid,
read its AGENTS.md and follow the steps. Always use the cartoon-story template.
```

The agent clones the repo, runs setup, writes the story, makes the pictures, and leaves you an MP4 in `videos/<name>/out/`.

## Setup (once, on a Mac)

Needs **Node.js 20+** and **Google Chrome**.

```bash
git clone https://github.com/iamyogeshmalkani/YVid.git
cd YVid
sh setup.sh
```

In every new terminal:

```bash
. ./env.sh
```

## Make a video by hand

```bash
scripts/new-video.sh cartoon-story my-story
# edit videos/my-story/script.md and shots.js
# then follow templates/cartoon-story/README.md
```

## What is in here

| Path | What it is |
|---|---|
| `templates/cartoon-story/` | the only template: fast cartoon shorts with a new picture almost every phrase |
| `AGENTS.md` | rules for the coding agent |
| `bin/`, `src/`, `engine/` | the explainroo engine (voice, timing, render) |
| `videos/` | your projects (git-ignored); created by `new-video.sh` |

Pictures in YVid use one of two paths only (see [SETUP-IMAGES.md](SETUP-IMAGES.md)):

1. **Perchance** — free AI stills in Chrome, no API key (`--perchance`)
2. **Code** — draw the frame yourself in `scenes.js` with the engine’s layout, text, shapes and HTML/CSS-style UI (no image model)

## License

MIT. Engine copyright Vincent Schmalbach (explainroo). YVid packaging and the cartoon-story template adaptations are under the same license.
