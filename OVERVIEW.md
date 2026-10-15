Backlog adds a workspace tab that shows a project's local markdown tracker as a board, and starts agents on its tasks.

Open it as a Backlog tab in a workspace (⌘K, "Open backlog"), or from the Backlog row in the sidebar, which shows any registered project without opening a workspace.

The tracker is the `.scratch/<effort>/issues/NN-*.md` layout: one file per issue, with `Status:`, `Assignee:`, `Labels:` and `Blocked by:` lines under the title. The board reads the main checkout of the workspace's project, so worktree workspaces show the same tracker.

## What you can do

- Switch between efforts. The board opens on the one changed most recently.
- See issues grouped into In flight, Ready to pick, Yours, Waiting, Later and Done. Blocked issues list what they wait on.
- Change an issue's status from the card. Only the `Status:` line in the file is rewritten.
- Pick an unblocked ready-for-agent issue. In a git project this creates a worktree on `feat/<scope>/<issue file>`, starts an agent there with an `/implement` prompt naming the issue's absolute path, and sets the status to in-progress. The scope is the first word of the effort name. The chevron next to Pick changes the branch type, scope, provider, model and mode for one pick. In a folder without git, the agent starts in the project folder instead.
- Use Help me on ready-for-human, needs-triage and planning (`wayfinder:` labelled) issues. It starts an agent in the main checkout with a walkthrough or planning prompt.
- Follow the agent from its card: running, waiting for permission, finished, failed or stopped. Tapping the badge opens the agent.
- Tap a card's title to read the issue file and copy its path.

The board updates within a second of any file under `.scratch/` changing, whether you, an agent or another tool edited it.

## Settings

Settings → Plugins → Backlog agent picks the provider, model and mode used by Pick and Help me. "Provider default" follows whatever the provider marks as its default.

## What it reads and writes

It reads and writes only issue files under the project's `.scratch/` folder, and refuses paths outside it. Links between cards and agents are kept in `$XDG_STATE_HOME/paseo-backlog/links.json` (default `~/.local/state`), keyed by the issue's path. Nothing is sent off the machine.

## Limits

- Paseo has no plugin API for opening a file in the Files tab, so issues open as plain text in a dialog.
- The worktree's agent edits the issue file in the main checkout, because `.scratch/` is not part of git.
- Requires Paseo 0.11.2 or later, on a macOS or Linux daemon. Windows paths are not handled.
