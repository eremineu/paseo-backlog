import { type PluginWorkspacePanelProps, usePaseo, useRpc } from "@getpaseo/plugin/client";
import { ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type AgentChoice, resolveAgentChoice } from "../shared/agent-choice";
import { type ActionConfig, renderTemplate } from "../shared/config";
import { type Board, type Card, branchNameFor, scopeFromEffort } from "../shared/issues";
import { saveLink, setStatus } from "../shared/rpc";
import { ActionMenu } from "./action-menu";
import { Chips } from "./chips";
import { type CardActions, IssueCard } from "./issue-card";
import { IssueViewer } from "./issue-viewer";
import { type PickOverrides, PickOptions } from "./pick-options";
import { startInMainCheckout, startInWorktree } from "./start-work";
import { StatusMenu } from "./status-menu";
import { useStyles } from "./styles";
import { useDefaultAgentChoice } from "./use-agent-choice";
import { useAgentStates } from "./use-agent-states";
import { backlogKey, useBacklog } from "./use-backlog";

const sections: readonly { key: keyof Board; title: string }[] = [
  { key: "inFlight", title: "In flight" },
  { key: "ready", title: "Ready to pick" },
  { key: "yours", title: "Yours" },
  { key: "waiting", title: "Waiting" },
  { key: "later", title: "Later" },
  { key: "done", title: "Done" },
];

type Dialog =
  | { kind: "status"; card: Card }
  | { kind: "view"; card: Card }
  | { kind: "menu"; card: Card }
  | { kind: "options"; card: Card; action: ActionConfig }
  | null;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const BacklogBoard = ({
  projectRoot,
  isGit,
  theme,
  layout,
  navigation,
  header,
}: Pick<PluginWorkspacePanelProps, "theme" | "layout" | "navigation"> & {
  projectRoot: string;
  isGit: boolean;
  header?: ReactNode;
}) => {
  const styles = useStyles(theme, layout.compact);
  const paseo = usePaseo();
  const toast = useToast();
  const queryClient = useQueryClient();
  const writeStatus = useRpc(setStatus);
  const writeLink = useRpc(saveLink);
  const { effortNames, effort, setEffort, efforts, board, links } = useBacklog(projectRoot);
  const agentStates = useAgentStates(Object.values(links).map((link) => link.agentId));
  const agents = useDefaultAgentChoice();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [showDone, setShowDone] = useState(false);

  const config = board.data?.config ?? null;
  const problems = board.data?.problems ?? efforts.data?.problems ?? [];
  const issuesDir = board.data?.issuesDir ?? null;
  const issuePathOf = (card: Card) => `${issuesDir}/${card.file}`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: backlogKey(projectRoot) });
  const openAgent = navigation ? (agentId: string) => navigation.openAgent({ agentId }) : null;
  const actionsOf = (card: Card) =>
    card.actionIds.flatMap((id) => config?.actions.filter((action) => action.id === id) ?? []);
  // A folder without git has no worktrees, so worktree actions run in the project itself.
  const usesWorktree = (action: ActionConfig) => action.runIn === "worktree" && isGit;

  // An action's own agent wins over the personal default; both fall back to provider defaults.
  const choiceFor = (action: ActionConfig): AgentChoice | null => {
    if (!action.agent) {
      return agents.choice;
    }
    if (agents.isLoading) {
      return null;
    }
    const { provider, model = "", modeId = "" } = action.agent;
    return resolveAgentChoice(agents.catalog, { provider, model, modeId });
  };

  // Says why no agent can start, so an action never fails silently.
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
      // Refetch before re-enabling the card, or its stale button invites a second start.
      await refresh();
      setBusy((current) => {
        const next = new Set(current);
        next.delete(card.file);
        return next;
      });
    }
  };

  const changeStatus = (card: Card, status: string) => {
    setDialog(null);
    if (!effort) {
      return;
    }
    void withBusy(card, async () => {
      await writeStatus({ projectRoot, effort, file: card.file, status });
    });
  };

  const defaultBranch = (card: Card, action: ActionConfig) =>
    branchNameFor({
      template: action.branch,
      type: action.branchType,
      scope: scopeFromEffort(effort ?? ""),
      effort: effort ?? "",
      file: card.file,
    });

  const runAction = (card: Card, action: ActionConfig, overrides: PickOverrides | null) => {
    setDialog(null);
    if (!effort || !issuesDir) {
      return;
    }
    const choice = overrides?.choice ?? choiceFor(action);
    if (!choice) {
      toast.error(agentProblem());
      return;
    }
    const inWorktree = usesWorktree(action);
    const branchName = inWorktree ? (overrides?.branchName ?? defaultBranch(card, action)) : "";
    const issuePath = issuePathOf(card);
    const prompt = renderTemplate(action.prompt, {
      issue: issuePath,
      map: board.data?.mapPath ?? issuePath,
      project: projectRoot,
      branch: branchName,
      id: card.id,
      title: card.title,
      effort,
    });
    const start = () =>
      inWorktree
        ? startInWorktree({ paseo, projectRoot, card, branchName, prompt, choice, issuePath })
        : startInMainCheckout({ paseo, projectRoot, card, prompt, choice, issuePath });

    // The status is written before the agent starts, since the agent edits the same file and must not be overwritten.
    void withBusy(card, async () => {
      const { setStatus: startStatus } = action;
      if (startStatus) {
        await writeStatus({ projectRoot, effort, file: card.file, status: startStatus });
      }
      const link = await start().catch(async (error: unknown) => {
        if (startStatus) {
          await writeStatus({ projectRoot, effort, file: card.file, status: card.status });
        }
        throw error;
      });
      await writeLink({ projectRoot, effort, file: card.file, link });
      toast.show(inWorktree ? `Started on ${branchName}` : `${action.label}: agent started`, { variant: "success" });
      openAgent?.(link.agentId);
    });
  };

  const openOptions = (card: Card, action: ActionConfig) => {
    if (!choiceFor(action)) {
      setDialog(null);
      toast.error(agentProblem());
      return;
    }
    setDialog({ kind: "options", card, action });
  };

  const cardActions: CardActions = {
    onStatus: (card) => setDialog({ kind: "status", card }),
    onView: (card) => setDialog({ kind: "view", card }),
    onRun: (card, action) => runAction(card, action, null),
    onMore: (card) => setDialog({ kind: "menu", card }),
    onOpenAgent: openAgent,
  };

  const renderProblems = () =>
    problems.length === 0 ? null : (
      <View style={[styles.card, { borderColor: theme.colors.statusWarning }]}>
        <Text style={[styles.text, { color: theme.colors.statusWarning }]}>
          Some backlog config was skipped and the rest still applies:
        </Text>
        {problems.map((problem) => (
          <Text key={`${problem.source}:${problem.message}`} selectable style={styles.muted}>
            {problem.source}: {problem.message}
          </Text>
        ))}
      </View>
    );

  const renderBody = () => {
    if (efforts.isLoading) {
      return <Text style={styles.muted}>Loading…</Text>;
    }
    if (effortNames.length === 0) {
      const folder = config?.tracker.folder ?? ".scratch";
      return (
        <Text style={styles.muted}>
          No tracker in {projectRoot}. Efforts live in {folder}/&lt;effort&gt;/issues/.
        </Text>
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
                  cardActions={actionsOf(card)}
                  link={links[card.file]}
                  agent={agentStates.get(links[card.file]?.agentId ?? "") ?? null}
                  busy={busy.has(card.file)}
                  theme={theme}
                  styles={styles}
                  actions={cardActions}
                />
              ))}
        </View>
      );
    });
  };

  const optionsChoice = dialog?.kind === "options" ? choiceFor(dialog.action) : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 8 }}>
          <Text style={styles.title}>Backlog</Text>
          {header}
          {effortNames.length > 1 ? (
            <Chips
              options={effortNames.map((name) => ({ value: name, label: name }))}
              value={effort}
              styles={styles}
              onChange={setEffort}
            />
          ) : null}
        </View>
        {renderProblems()}
        {renderBody()}
      </ScrollView>

      {dialog?.kind === "status" && config ? (
        <StatusMenu
          title={`#${dialog.card.id} status`}
          current={dialog.card.status}
          statuses={config.tracker.statuses.map((status) => status.name)}
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
      {dialog?.kind === "menu" ? (
        <ActionMenu
          title={`#${dialog.card.id} ${dialog.card.title}`}
          actions={actionsOf(dialog.card)}
          styles={styles}
          onRun={(action) => runAction(dialog.card, action, null)}
          onOptions={(action) => openOptions(dialog.card, action)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "options" && effort && optionsChoice ? (
        <PickOptions
          actionLabel={dialog.action.label}
          file={dialog.card.file}
          inWorktree={usesWorktree(dialog.action)}
          branchTemplate={dialog.action.branch}
          defaultType={dialog.action.branchType}
          defaultScope={scopeFromEffort(effort)}
          effort={effort}
          defaultChoice={optionsChoice}
          catalog={agents.catalog}
          styles={styles}
          onStart={(overrides) => runAction(dialog.card, dialog.action, overrides)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </View>
  );
};
