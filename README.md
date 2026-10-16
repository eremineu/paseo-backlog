# Paseo backlog

A Paseo plugin that shows a markdown issue tracker as a board and starts agents on its tasks. What it does for the user is in [OVERVIEW.md](OVERVIEW.md).

## Install

```bash
paseo plugin install github:<owner>/paseo-backlog
paseo plugin update paseo-backlog   # later, for new versions
```

## Configure

Out of the box the plugin reads `.scratch/<effort>/issues/NN-*.md` and offers four plain-language actions. Anything can be changed in two layers on top of that, each later one winning:

1. **The repo:** a `backlog` key in `paseo.json` at the project root, committed and shared by everyone working on it.
2. **You:** Settings → Plugins → Backlog → "Your backlog config", for your daemon only.

Both take the same shape:

```json
{
  "backlog": {
    "version": 1,
    "tracker": {
      "folder": ".scratch",
      "planningLabelPrefix": "wayfinder:",
      "statuses": [
        { "name": "todo", "section": "ready" },
        { "name": "doing", "section": "inFlight" },
        { "name": "done", "section": "done" }
      ]
    },
    "actions": [
      {
        "id": "pick",
        "label": "Ship it",
        "showFor": { "statuses": ["todo"], "planning": "exclude" },
        "runIn": "worktree",
        "branch": "{type}/{effortPrefix}/{slug}",
        "setStatus": "doing",
        "agent": { "provider": "claude", "model": "claude-opus-5-5" },
        "prompt": "/ship {issue}"
      },
      { "id": "plan", "hidden": true }
    ]
  }
}
```

In the personal layer, leave out the outer `backlog` key and start at `version`.

### Tracker

| Field | Default | Meaning |
| --- | --- | --- |
| `folder` | `.scratch` | Folder under the project root holding `<effort>/issues/*.md` and an optional `<effort>/map.md` |
| `statuses` | the nine below | Status words in the issue's `Status:` line, each placed in a section: `inFlight`, `ready`, `yours`, `later` or `done`. Unknown words show under Later. |
| `planningLabelPrefix` | `wayfinder:` | Issues with a label starting with this are planning work; `""` turns it off |

Default statuses: `in-progress` and `in-review` (in flight), `ready-for-agent` (ready), `ready-for-human` (yours), `needs-triage` and `needs-info` (later), `done`, `closed` and `wontfix` (done). Blocked ready or yours issues show under Waiting. Planning issues with a ready status show under Yours.

Tracker fields override one by one, so a repo can change only `folder`. A `statuses` list replaces the whole list.

### Actions

Actions merge by `id`: the same id replaces that action, a new id is added at the end, `{ "id": "…", "hidden": true }` removes one. The first action that applies to a card is its button. The chevron next to it opens the options dialog for that action, to change the branch and agent for one run; when several actions apply, the dialog also lets you pick which one to run.

| Field | Default | Meaning |
| --- | --- | --- |
| `id`, `label` | required | Identity for merging, and the button text |
| `showFor.statuses` | every status not in Done | Statuses the action appears on |
| `showFor.planning` | `any` | `only` planning issues, `exclude` them, or `any` |
| `showFor.blocked` | `false` | Whether issues waiting on open blockers get it |
| `runIn` | required | `worktree`: a new git worktree on `branch`. `project`: the project folder. Worktree actions run in the project folder when it isn't a git repo. |
| `branch`, `branchType` | `{type}/{effortPrefix}/{slug}`, `feat` | Branch template for worktree actions |
| `setStatus` | `null` | Status written when the agent starts, put back if starting fails |
| `agent` | your default agent | `provider`, optional `model` and `modeId` for this action |
| `prompt` | required | Text sent to the agent |

Placeholders in `prompt`: `{issue}` (absolute path of the issue file), `{map}` (the effort's `map.md`, or the issue path when there is none), `{project}`, `{branch}`, `{id}`, `{title}`, `{effort}`. In `branch`: `{type}`, `{effortPrefix}` (first word of the effort name), `{effort}`, `{slug}` (issue file name), `{id}`. An unknown placeholder is left as written, so a typo shows in the prompt.

The issue file lives in the main checkout because the tracker folder is usually gitignored, so prompts for worktree actions should name `{issue}` rather than a relative path.

An invalid layer is skipped whole; the board shows a banner naming the file and the first problem, and the other layers still apply. The settings editor checks your layer before saving it.

## Develop

```bash
npm install
npm run typecheck
npm test
paseo plugin install "$PWD"   # first time
paseo plugin reload paseo-backlog
paseo plugin logs paseo-backlog
```

| Path | Runs in | What it holds |
| --- | --- | --- |
| `shared/config.ts` | both | Config schema, built-in defaults, layer merge, action matching, templates |
| `shared/issues.ts` | both | Issue parsing, board sections, status rewrite, branch names |
| `shared/rpc.ts` | both | RPC contracts between the panel and the daemon |
| `server/config.ts` | daemon | Reads `paseo.json` and the personal layer |
| `server/tracker.ts` | daemon | Reads and writes issue files, watches the tracker and `paseo.json` for the long poll |
| `server/links.ts` | daemon | Card-to-agent links in `~/.local/state/paseo-backlog/links.json` |
| `client/board.tsx` | app | The board: sections, cards, running actions |
| `client/board-panel.tsx`, `client/board-screen.tsx` | app | The workspace tab, and the sidebar screen with a project picker |
| `client/personal-config-section.tsx`, `client/settings-screen.tsx` | app | Settings: default agent and the personal config editor |
| `client/start-work.ts` | app | Creates the worktree or opens the project folder, then starts the agent |

Live updates are a long poll: `backlog.wait` resolves as soon as the tracker, `paseo.json` or the personal config changes, or after 20 s, under Paseo's 30 s RPC timeout. Linked agents' states refresh every 3 s.

Both entries default-export a `function` declaration. Paseo's bundler reads the default export eagerly, and a `const` export is still undefined at that point, so the plugin fails to load.
