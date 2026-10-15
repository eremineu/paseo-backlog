import type { usePaseo } from "@getpaseo/plugin/client";
import { type AgentChoice, providerString } from "../shared/agent-choice";
import type { Card } from "../shared/issues";

// Client bundles may only import host-provided modules, so the API type comes through the plugin SDK.
type PaseoApi = ReturnType<typeof usePaseo>;

const agentConfig = (choice: AgentChoice) => ({
  provider: providerString(choice),
  ...(choice.modeId ? { modeId: choice.modeId } : {}),
});

const titleOf = (card: Card) => `${card.id} ${card.title}`;

// A fresh worktree on its own branch, with the agent started inside it.
export const startInWorktree = async ({
  paseo,
  projectRoot,
  card,
  branchName,
  prompt,
  choice,
  issuePath,
}: {
  paseo: PaseoApi;
  projectRoot: string;
  card: Card;
  branchName: string;
  prompt: string;
  choice: AgentChoice;
  issuePath: string;
}) => {
  const workspace = await paseo.workspaces.create({
    title: titleOf(card),
    source: { kind: "worktree", cwd: projectRoot, action: "branch-off", branchName },
  });
  try {
    const agent = await workspace.agents.create({
      config: agentConfig(choice),
      title: titleOf(card),
      prompt,
      labels: { "backlog.issue": issuePath },
    });
    return { agentId: agent.id, workspaceId: workspace.id };
  } catch (error) {
    await workspace.archive().catch(() => undefined);
    throw error;
  }
};

// Help sessions don't change code, so they run in the main checkout itself.
export const startInMainCheckout = async ({
  paseo,
  projectRoot,
  card,
  prompt,
  choice,
  issuePath,
}: {
  paseo: PaseoApi;
  projectRoot: string;
  card: Card;
  prompt: string;
  choice: AgentChoice;
  issuePath: string;
}) => {
  const workspace = await paseo.workspaces.open(projectRoot);
  const agent = await workspace.agents.create({
    config: agentConfig(choice),
    title: titleOf(card),
    prompt,
    labels: { "backlog.issue": issuePath },
  });
  return { agentId: agent.id, workspaceId: workspace.id };
};
