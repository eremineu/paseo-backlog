import type { Card } from "./issues";

// Worktrees don't carry the gitignored `.scratch/`, so every prompt names the main checkout's file.
export const pickPrompt = (issuePath: string) =>
  `/implement ${issuePath} — the issue file lives in the main checkout, so edit it at that exact path. When it's built, tested and committed, set the issue's Status to closed and add a short note under "## Comments" on what was built.`;

export const helpPrompt = (card: Pick<Card, "status" | "isPlanning">, issuePath: string, mapPath: string | null) => {
  if (card.isPlanning) {
    return mapPath ? `/wayfinder ${mapPath}` : `Help me decide ${issuePath}.`;
  }
  if (card.status === "ready-for-human") {
    return `Help me do ${issuePath}. Walk me through it one step at a time and do the parts you can yourself. When it's finished, set its Status to closed and add a short note under "## Comments".`;
  }
  return `Help me turn ${issuePath} into a plan: ask me what you need, then split it into ready-to-build issues in the same folder.`;
};
