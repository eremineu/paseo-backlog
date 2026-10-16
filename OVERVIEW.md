Backlog shows a project's markdown issue tracker as a board and starts agents on its tasks with your own prompts.

Open it as a Backlog tab in a workspace (⌘K, "Open backlog"), or from the Backlog row in the sidebar, which shows any registered project without opening a workspace.

By default the tracker is the `.scratch/<effort>/issues/NN-*.md` layout: one file per issue, with `Status:`, `Assignee:`, `Labels:` and `Blocked by:` lines under the title. The board reads the main checkout of the workspace's project, so worktree workspaces show the same tracker.

## What you can do

- Switch between efforts. The board opens on the one changed most recently.
- See issues grouped into In flight, Ready to pick, Yours, Waiting, Later and Done. Blocked issues list what they wait on.
- Change an issue's status from the card. Only the `Status:` line in the file is rewritten.
- Start an agent on an issue with the card's button. Each action decides which issues it appears on, whether it runs in a new git worktree or the project folder, which status to set when it starts, which agent to use and what prompt to send. The chevron next to the button opens its options, to change the branch and agent for one run, or to run any other action on that card.
- Follow the agent from its card: running, waiting for permission, finished, failed or stopped. Tapping the badge opens the agent.
- Tap a card's title to read the issue file and copy its path.

The board updates within a second of an issue file or the repo's config changing, whether you, an agent or another tool edited it.

## Built-in actions

With no config, ready-for-agent issues get Pick (a worktree, status in-progress), ready-for-human issues get Help me, needs-triage issues get Plan it, and planning issues (labelled `wayfinder:`) get Help me decide. Their prompts are plain language and use no slash commands.

## Config

A team can commit a `backlog` key to the repo's `paseo.json`, and each person can add their own layer in Settings → Plugins → Backlog, with forms to edit, add, hide or reset actions and change the tracker. Both can change the tracker folder, the statuses and the actions, including the prompts, so everyone can point actions at their own skills. The README describes every field.

Settings → Plugins → Backlog also sets the default agent used by actions that don't name one. "Provider default" follows whatever the provider marks as its default.

## What it reads and writes

It reads the repo's `paseo.json`, and reads and writes only issue files under the configured tracker folder, refusing paths outside it. Links between cards and agents are kept in `$XDG_STATE_HOME/paseo-backlog/links.json` (default `~/.local/state`), keyed by the issue's path. Nothing is sent off the machine.

## Limits

- Paseo has no plugin API for opening a file in the Files tab, so issues open as plain text in a dialog.
- A worktree's agent edits the issue file in the main checkout, because the tracker folder is usually not part of git.
- Requires Paseo 0.11.2 or later, on a macOS or Linux daemon. Windows paths are not handled.
