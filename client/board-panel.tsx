import { type PluginWorkspacePanelProps, usePaseo, useRpc, useWorkspace } from "@getpaseo/plugin/client";
import { ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type Board, type Card, type Status, scopeFromEffort, branchNameFor } from "../shared/issues";
import { helpPrompt, pickPrompt } from "../shared/prompts";
import { saveLink, setStatus } from "../shared/rpc";
import { Chips } from "./chips";
import { IssueCard, type CardActions } from "./issue-card";
import { IssueViewer } from "./issue-viewer";
import { PickOptions, type PickOverrides } from "./pick-options";
import { startInMainCheckout, startInWorktree } from "./start-work";
import { StatusMenu } from "./status-menu";
import { useStyles } from "./styles";
import { useDefaultAgentChoice } from "./use-agent-choice";
import { backlogKey, useBacklog } from "./use-backlog";

const sections: readonly { key: keyof Board; title: string }[] = [
  { key: "inFlight", title: "In flight" },
  { key: "ready", title: "Ready to pick" },
  { key: "yours", title: "Yours" },
  { key: "waiting", title: "Waiting" },
  { key: "later", title: "Later" },
  { key: "done", title: "Done" },
];

type Dialog = { kind: "status"; card: Card } | { kind: "view"; card: Card } | { kind: "options"; card: Card } | null;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const BoardPanel = ({ theme, layout, workspaceId, navigation }: PluginWorkspacePanelProps) => {
  const styles = useStyles(theme, layout.compact);
  const paseo = usePaseo();
  const toast = useToast();
  const queryClient = useQueryClient();
  const writeStatus = useRpc(setStatus);
  const writeLink = useRpc(saveLink);
  const project = useWorkspace(workspaceId, ({ projectRootPath, projectKind }) => ({ projectRootPath, projectKind }));
  const projectRoot = project?.projectRootPath ?? null;
  const isGit = project?.projectKind === "git";
  const { effortNames, effort, setEffort, efforts, board, links } = useBacklog(projectRoot);
  const agents = useDefaultAgentChoice();
  const { catalog, choice: defaultChoice } = agents;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [showDone, setShowDone] = useState(false);

  if (!projectRoot) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.muted}>Workspace not loaded yet.</Text>
      </View>
    );
  }

  const issuesDir = board.data?.issuesDir ?? null;
  const issuePathOf = (card: Card) => `${issuesDir}/${card.file}`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: backlogKey(projectRoot) });
  const openAgent = navigation ? (agentId: string) => navigation.openAgent({ agentId }) : null;

  // Says why no agent can start, so Pick and the options chevron never fail silently.
  const agentProblem = () => {
    if (agents.isLoading) {
      return "Still loading the agent providers, try again in a moment.";
    }
    if (agents.error) {
      return `Could not load agent providers: ${errorText(agents.error)}`;
    }
    return "No agent provider with models is available. Check Settings, then Providers.";
  };

  const withBusy = async (card: Card, work: () => Promise<void>) => {
    setBusy((current) => new Set(current).add(card.file));
    try {
      await work();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      // Refetch before re-enabling the card, or its stale Pick button invites a second worktree.
      await refresh();
      setBusy((current) => {
        const next = new Set(current);
        next.delete(card.file);
        return next;
      });
    }
  };

  const changeStatus = (card: Card, status: Status) => {
    setDialog(null);
    if (!effort) {
      return;
    }
    void withBusy(card, async () => {
      await writeStatus({ projectRoot, effort, file: card.file, status });
    });
  };

  const pick = (card: Card, overrides: PickOverrides | null) => {
    setDialog(null);
    const choice = overrides?.choice ?? defaultChoice;
    if (!effort || !issuesDir) {
      return;
    }
    if (!choice) {
      toast.error(agentProblem());
      return;
    }
    const branchName =
      overrides?.branchName ?? branchNameFor({ type: "feat", scope: scopeFromEffort(effort), file: card.file });
    // The status is written before the agent starts, since the agent edits the same file and must not be overwritten.
    // A folder without git has no worktrees, so the agent works in the project itself.
    const start = () =>
      isGit
        ? startInWorktree({
            paseo,
            projectRoot,
            card,
            branchName,
            prompt: pickPrompt(issuePathOf(card), true),
            choice,
            issuePath: issuePathOf(card),
          })
        : startInMainCheckout({
            paseo,
            projectRoot,
            card,
            prompt: pickPrompt(issuePathOf(card), false),
            choice,
            issuePath: issuePathOf(card),
          });
    void withBusy(card, async () => {
      await writeStatus({ projectRoot, effort, file: card.file, status: "in-progress" });
      const link = await start().catch(async (error: unknown) => {
        await writeStatus({ projectRoot, effort, file: card.file, status: "ready-for-agent" });
        throw error;
      });
      await writeLink({ projectRoot, effort, file: card.file, link });
      toast.show(isGit ? `Started on ${branchName}` : "Started in the project folder", { variant: "success" });
      openAgent?.(link.agentId);
    });
  };

  const help = (card: Card) => {
    if (!effort || !issuesDir) {
      return;
    }
    if (!defaultChoice) {
      toast.error(agentProblem());
      return;
    }
    void withBusy(card, async () => {
      const link = await startInMainCheckout({
        paseo,
        projectRoot,
        card,
        prompt: helpPrompt(card, issuePathOf(card), board.data?.mapPath ?? null),
        choice: defaultChoice,
        issuePath: issuePathOf(card),
      });
      await writeLink({ projectRoot, effort, file: card.file, link });
      openAgent?.(link.agentId);
    });
  };

  const actions: CardActions = {
    onStatus: (card) => setDialog({ kind: "status", card }),
    onView: (card) => setDialog({ kind: "view", card }),
    onPick: (card) => pick(card, null),
    onPickWithOptions: (card) => {
      if (!defaultChoice) {
        toast.error(agentProblem());
        return;
      }
      setDialog({ kind: "options", card });
    },
    onHelp: help,
    onOpenAgent: openAgent,
  };

  const renderBody = () => {
    if (efforts.isLoading) {
      return <Text style={styles.muted}>Loading…</Text>;
    }
    if (effortNames.length === 0) {
      return (
        <Text style={styles.muted}>No tracker in {projectRoot}. Efforts live in .scratch/&lt;effort&gt;/issues/.</Text>
      );
    }
    if (board.error) {
      return <Text style={styles.danger}>{errorText(board.error)}</Text>;
    }
    if (!board.data) {
      return <Text style={styles.muted}>Loading…</Text>;
    }
    const data = board.data.board;
    return sections.map(({ key, title }) => {
      const cards = data[key];
      if (cards.length === 0) {
        return null;
      }
      const isDone = key === "done";
      const collapsed = isDone && !showDone;
      const toggleLabel = showDone ? "  hide" : "  show";
      return (
        <View key={key} style={{ gap: 8 }}>
          <Pressable accessibilityRole="button" disabled={!isDone} onPress={() => setShowDone((current) => !current)}>
            <Text style={styles.sectionTitle}>
              {title} · {cards.length}
              {isDone ? toggleLabel : ""}
            </Text>
          </Pressable>
          {collapsed
            ? null
            : cards.map((card) => (
                <IssueCard
                  key={card.file}
                  card={card}
                  link={links[card.file]}
                  busy={busy.has(card.file)}
                  theme={theme}
                  styles={styles}
                  actions={actions}
                />
              ))}
        </View>
      );
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 8 }}>
          <Text style={styles.title}>Backlog</Text>
          {effortNames.length > 1 ? (
            <Chips
              options={effortNames.map((name) => ({
                value: name,
                label: name,
              }))}
              value={effort}
              styles={styles}
              onChange={setEffort}
            />
          ) : null}
        </View>
        {renderBody()}
      </ScrollView>

      {dialog?.kind === "status" ? (
        <StatusMenu
          title={`#${dialog.card.id} status`}
          current={dialog.card.status}
          styles={styles}
          onPick={(status) => changeStatus(dialog.card, status)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "view" && effort ? (
        <IssueViewer
          projectRoot={projectRoot}
          effort={effort}
          file={dialog.card.file}
          title={`#${dialog.card.id} ${dialog.card.title}`}
          styles={styles}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "options" && effort && defaultChoice ? (
        <PickOptions
          file={dialog.card.file}
          isGit={isGit}
          defaultScope={scopeFromEffort(effort)}
          defaultChoice={defaultChoice}
          catalog={catalog}
          styles={styles}
          onStart={(overrides) => pick(dialog.card, overrides)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </View>
  );
};
