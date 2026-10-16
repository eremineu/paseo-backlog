# paseo-backlog

A [Paseo](https://paseo.sh) plugin that turns a folder of markdown issues into a board, and starts an agent on an issue when you press a button on its card.

I wrote it because my backlog lived in `.scratch/<effort>/issues/*.md` files and starting work meant copying a prompt, making a worktree and pasting the prompt into a new agent. Now that's one click, and the card shows whether the agent is still running, waiting for a permission, or done.

You need Paseo 0.11.2 or newer on macOS or Linux.

## Install

Turn plugins on in Paseo first (Settings → Plugins → Enable plugins), then run:

```bash
paseo plugin install github:eremineu/paseo-backlog
```

Check it loaded:

```bash
paseo plugin ls        # paseo-backlog should say "running"
```

To get a newer version later, run `paseo plugin update paseo-backlog`. To remove it, run `paseo plugin remove paseo-backlog`.

## Open the board

There are two ways in.

- Inside a workspace, press ⌘K and run "Open backlog". The board opens as a tab next to your agents and terminals, for that workspace's project.
- From the sidebar, click Backlog. You get a full screen with a project picker, so you can look at any project without opening a workspace first.

If the project has more than one effort, chips at the top switch between them. The board opens on the effort you changed most recently.

## What the plugin expects on disk

By default it reads `.scratch/` at the project root. Each subfolder is an effort, and each effort keeps its issues in `issues/`:

```text
.scratch/
  checkout-redesign/
    map.md                      optional, passed to prompts as {map}
    issues/
      01-pick-payment-provider.md
      02-new-cart-page.md
```

An issue is a markdown file with a title and a few header lines before the first `## ` section:

```markdown
# New cart page

Status: ready-for-agent
Assignee: unclaimed
Labels: frontend
Blocked by: 01

## Task

Build the cart page from the design in Figma. Keep the old page behind a flag.
```

`Status` decides where the card goes and which button it gets. `Blocked by` takes issue numbers (`01`, `#01`, or a link to `01-something.md`). While a blocker is still open, the card moves to Waiting and shows what it's waiting on. `**Status:**` in bold works too, and status words are case-insensitive.

The folder name and the list of statuses are configurable (see below). The header format isn't.

## Using the board

Cards are grouped into In flight, Ready to pick, Yours, Waiting, Later and Done. Done starts collapsed.

The blue button on a card runs that card's main action. With the built-in config that's:

| Card status | Button | What happens |
| --- | --- | --- |
| ready-for-agent | Pick | Sets the status to in-progress, creates a git worktree on `feat/<first word of the effort>/<issue file>`, starts an agent there |
| ready-for-human | Help me | Starts an agent in the project folder that walks you through the task |
| needs-triage | Plan it | Starts an agent that turns the issue into smaller ready issues |
| planning label (`wayfinder:` by default) | Help me decide | Starts an agent that asks you questions until a decision is written down |

The arrow next to the button opens the options dialog. There you can change the branch name, provider, model and mode for this one run, or pick a different action from the Action dropdown. Every action can run on any card that isn't done. The status only decides which one is the main button. Cards with no matching action get a "Run…" button that opens the same dialog.

Other things on a card:

- The status chip opens a list of statuses. Picking one rewrites only the `Status:` line in the file.
- After an agent starts, a badge on the card shows its state (running, waiting for permission, finished, failed, stopped). Click it to jump to the agent.
- Clicking the title shows the issue file as text, with a button to copy its path.

The board follows the files. If you or an agent edits an issue, the card moves within a second. Agent badges refresh every few seconds.

A worktree doesn't contain `.scratch/` because the folder is usually gitignored. That's why the built-in prompts give the agent the issue's absolute path in the main checkout, so status edits land in the file the board is watching. If you write your own prompts, use `{issue}` rather than a relative path.

If the project isn't a git repo, worktree actions start in the project folder instead.

## Making it yours

The built-in prompts are plain English and don't call any skills. Most people will want to point them at their own commands. There are two places to do that, and the later one wins.

1. The repo. A `backlog` key in `paseo.json` at the project root, committed, so everyone on the project gets the same actions.
2. You. Settings → Plugins → Backlog. This only affects your own Paseo.

### In the settings screen

The settings screen covers most of what you'd want without touching JSON.

- Default agent sets the provider, model and mode for any action that doesn't name its own.
- Preview with a project picks a repo, so you see your changes on top of that repo's `paseo.json`.
- Actions lists every action with where it comes from: built-in, the team's `paseo.json`, or yours. Edit opens a form for when the action shows, where it runs, the branch, the status to set on start, the agent and the prompt. Editing a built-in or team action saves your own copy, and Reset throws your copy away again. Hide removes an action for you. Add action creates a new one.
- Tracker sets the folder, the planning label and the status list.
- Advanced has the same config as raw JSON. It's handy for sending your setup to someone, or fixing something the forms can't read.

### In `paseo.json`

Here's a team config that swaps the statuses for a simpler set, points Pick at a skill, and hides Plan it:

```json
{
  "backlog": {
    "version": 1,
    "tracker": {
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
        "setStatus": "doing",
        "prompt": "/my-skill {issue}"
      },
      { "id": "plan", "hidden": true }
    ]
  }
}
```

The personal layer has the same shape without the outer `backlog` key.

Actions merge by `id`. A layer that uses an existing id replaces that action, a new id adds one at the end, and `{ "id": "...", "hidden": true }` removes one. Tracker fields override one at a time, so a repo can change only the folder. A `statuses` list always replaces the whole list.

If a layer doesn't validate, the plugin ignores that whole layer and shows a banner on the board with the file and the field that broke. Your personal layer is checked before it's saved. An action that refers to a status the tracker doesn't list gets a warning, but everything else still applies.

### Tracker fields

| Field | Default | Meaning |
| --- | --- | --- |
| `folder` | `.scratch` | Folder under the project root that holds the efforts |
| `statuses` | nine, see below | Status words, each put in a section: `inFlight`, `ready`, `yours`, `later` or `done` |
| `planningLabelPrefix` | `wayfinder:` | A label starting with this marks a planning issue. An empty string turns it off. |

The default statuses are `in-progress` and `in-review` (in flight), `ready-for-agent` (ready), `ready-for-human` (yours), `needs-triage` and `needs-info` (later), and `done`, `closed` and `wontfix` (done). A status that isn't in the list shows under Later, so you can still fix it from the card.

### Action fields

| Field | Default | Meaning |
| --- | --- | --- |
| `id`, `label` | required | The id used for merging, and the button text |
| `showFor.statuses` | any status not in Done | Statuses where this is the main button |
| `showFor.planning` | `any` | `only` for planning issues, `exclude` to skip them, `any` for both |
| `showFor.blocked` | `false` | Whether blocked issues get it as their main button |
| `runIn` | required | `worktree` for a new git worktree, `project` for the project folder |
| `branch` | `{type}/{effortPrefix}/{slug}` | Branch name template for worktree actions |
| `branchType` | `feat` | What `{type}` becomes |
| `setStatus` | none | Status written when the agent starts. If the start fails, the old status goes back. |
| `agent` | your default | `{ "provider": "claude", "model": "...", "modeId": "..." }` for this action |
| `prompt` | required | Text sent to the agent |

Placeholders you can use in `prompt`:

| Placeholder | Becomes |
| --- | --- |
| `{issue}` | Absolute path of the issue file |
| `{map}` | The effort's `map.md`, or the issue path if there isn't one |
| `{project}` | Project root |
| `{branch}` | Branch name, empty outside a worktree |
| `{id}`, `{title}`, `{effort}` | The issue number, its title, the effort folder name |

In `branch` you can use `{type}`, `{effortPrefix}` (the effort name up to its first dash), `{effort}`, `{slug}` (the issue file name) and `{id}`. A placeholder the plugin doesn't know stays in the text as written, so a typo shows up in the prompt instead of disappearing.

## What it touches

The plugin reads `paseo.json` and the files in the tracker folder. The only file it writes in your repo is the `Status:` line of an issue, and it refuses any path outside the tracker folder. It remembers which agent belongs to which card in `~/.local/state/paseo-backlog/links.json`. It doesn't send anything off your machine.

Paseo plugins run as trusted code with full access to your machine. Read the source before you install, like with any other plugin.

## Known gaps

- Paseo doesn't let plugins open a file in its Files tab, so an issue opens as plain text in a dialog.
- The options dialog is 520px wide. The Paseo host sets that size and plugins can't change it.
- Windows paths aren't handled.

## Working on the plugin

```bash
git clone git@github.com:eremineu/paseo-backlog.git
cd paseo-backlog
npm install
npm run typecheck
npm test
paseo plugin install "$PWD"        # installs from your checkout
paseo plugin reload paseo-backlog  # after every change
paseo plugin logs paseo-backlog    # server-side output and crashes
```

If you already installed it from GitHub, remove that one first (`paseo plugin remove paseo-backlog`), or install your checkout under another id with `--id`.

The code is split the way Paseo plugins have to be. `shared/` runs in both places, `server/` runs in the daemon, and `client/` runs in the app.

| Path | What's in it |
| --- | --- |
| `shared/config.ts` | Config schema, built-in defaults, merging layers, matching actions to cards, templates |
| `shared/issues.ts` | Parsing issue files, building the board, rewriting the status line, branch names |
| `shared/layers.ts` | Which layer each action comes from, and edits to the personal layer |
| `shared/rpc.ts` | The calls between the app and the daemon |
| `server/tracker.ts` | Reading and writing issue files, and watching the tracker folder and `paseo.json` |
| `server/config.ts` | Loading `paseo.json` and the personal layer |
| `server/links.ts` | Card-to-agent links |
| `client/board.tsx` | The board and running actions |
| `client/board-panel.tsx`, `client/board-screen.tsx` | The workspace tab and the sidebar screen |
| `client/settings-screen.tsx`, `client/config-settings.tsx` and the files they import | The settings screen |

Some things that will bite you:

- Plugin RPCs time out after 30 seconds. Live updates use a long poll that the daemon answers when a file changes, or after 20 seconds of quiet.
- Both entry files must `export default function contribute(...)`. A `const` arrow function exported as the default loads as undefined, because Paseo reads the default export before the module finishes.
- `useWorkspace` and `useAgent` only work inside a workspace panel. The board also renders on the sidebar screen, so it reads agents through the SDK instead.
- The app's own Paseo connection sends provider lists without models, so models and modes come from `listModels` and `listModes`.

[OVERVIEW.md](OVERVIEW.md) is the short description Paseo shows on the plugin's page.
