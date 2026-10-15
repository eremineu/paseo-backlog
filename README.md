# Paseo backlog

A Paseo plugin that shows a `.scratch/<effort>/issues/` markdown tracker as a workspace tab and starts agents on its tasks. What it does for the user is in [OVERVIEW.md](OVERVIEW.md).

## Develop

```bash
npm install
npm run typecheck
npm test
paseo plugin install "$PWD"   # first time
paseo plugin reload paseo-backlog
paseo plugin logs paseo-backlog
```

## Layout

| Path | Runs in | What it holds |
| --- | --- | --- |
| `shared/issues.ts` | both | Issue parsing, board sections, pick and help rules, status rewrite, branch names |
| `shared/prompts.ts` | both | Prompts for Pick and Help me |
| `shared/rpc.ts` | both | RPC contracts between the panel and the daemon |
| `server/tracker.ts` | daemon | Reads and writes issue files, watches `.scratch/` for the long poll |
| `server/links.ts` | daemon | Card-to-agent links in `~/.local/state/paseo-backlog/links.json` |
| `client/board-panel.tsx` | app | The Backlog workspace panel |
| `client/start-work.ts` | app | Creates the worktree or opens the main checkout, then starts the agent |

Live updates are a long poll: `backlog.wait` resolves as soon as `.scratch/` changes, or after 20 s, under Paseo's 30 s RPC timeout.

Both entries default-export a `function` declaration. Paseo's bundler reads the default export eagerly, and a `const` export is still undefined at that point, so the plugin fails to load.
