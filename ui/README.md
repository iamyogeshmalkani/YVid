# YVid Studio

Local web UI for making videos: pick a template, type a topic, press **Make my video**.

```bash
cd /path/to/YVid
. ./env.sh                 # after setup.sh once
node ui/server.mjs         # open http://127.0.0.1:4747
```

Needs Node setup (`sh setup.sh`) and the `claude` CLI (Claude Code, logged in). No extra npm packages for the UI.

## Templates

| Template | Pictures |
|---|---|
| **Cartoon story** | Perchance AI stills |
| **Dark history** | Perchance cinematic paintings |
| **Code explainer** | Drawn in `scenes.js` (no AI images) |

## Notes

- Listens on `127.0.0.1` only. Do not expose the port.
- Jobs run one at a time. Cancel stops the agent.
- Library lists finished videos under `videos/`.
