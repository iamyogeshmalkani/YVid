# YVid

Short narrated videos made by your AI coding agent — **cartoon stories** or **code-drawn explainers**.

Free and open source. Voice, timing and rendering run on your computer.
Built on [explainroo](https://github.com/vincentsch/explainroo) (MIT).

## Make a video

Copy this into Claude Code, Codex, Cursor, or any coding agent:

```text
Make me a short video about [your topic].
Use YVid for it: clone https://github.com/iamyogeshmalkani/YVid,
read its AGENTS.md and follow the steps.
Use the cartoon-story template for cartoon stills, or code-explainer for diagrams drawn in code.
```

Or open **YVid Studio** after setup:

```bash
node ui/server.mjs    # http://127.0.0.1:4747
```

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

## Templates

| Template | What you get | Pictures |
|---|---|---|
| `cartoon-story` | Fast cartoon short, new still almost every phrase | **Perchance** (free, no key) |
| `code-explainer` | Steps, diagrams, UI, type-led teaching | **Drawn in code** in `scenes.js` |

```bash
scripts/new-video.sh cartoon-story my-story
scripts/new-video.sh code-explainer my-topic
```

## What is in here

| Path | What it is |
|---|---|
| `templates/` | the two templates above |
| `ui/` | YVid Studio (local web UI) |
| `AGENTS.md` | rules for the coding agent |
| `bin/`, `src/`, `engine/` | the explainroo engine |
| `videos/` | your projects (git-ignored) |

See [SETUP-IMAGES.md](SETUP-IMAGES.md) for Perchance vs code-drawn pictures.

## License

MIT. Engine copyright Vincent Schmalbach (explainroo). YVid packaging and templates are under the same license.
