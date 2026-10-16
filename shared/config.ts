import { z } from "zod";

// `waiting` is derived from blockers, so a status can't be assigned to it directly.
export const assignableSections = ["inFlight", "ready", "yours", "later", "done"] as const;

const relativeFolder = z
  .string()
  .min(1)
  .refine(
    (folder) => {
      const parts = folder.split(/[/\\]/).filter((part) => part !== "" && part !== ".");
      return !folder.startsWith("/") && parts.length > 0 && !parts.includes("..");
    },
    { message: "must be a folder inside the project" },
  );

// Issue files are read case-insensitively, so configured names are too.
const statusName = z
  .string()
  .min(1)
  .transform((name) => name.toLowerCase());

export const trackerSchema = z.object({
  folder: relativeFolder,
  statuses: z.array(z.object({ name: statusName, section: z.enum(assignableSections) }).strict()).min(1),
  planningLabelPrefix: z.string(),
});
export type TrackerConfig = z.infer<typeof trackerSchema>;

export const actionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  showFor: z
    .object({
      // Omitted: every status outside the done section.
      statuses: z.array(statusName).optional(),
      planning: z.enum(["any", "only", "exclude"]).default("any"),
      blocked: z.boolean().default(false),
    })
    .strict()
    .default({ planning: "any", blocked: false }),
  runIn: z.enum(["worktree", "project"]),
  branch: z.string().min(1).default("{type}/{effortPrefix}/{slug}"),
  branchType: z.string().min(1).default("feat"),
  setStatus: statusName.nullable().default(null),
  agent: z.object({ provider: z.string(), model: z.string().optional(), modeId: z.string().optional() }).strict().optional(),
  prompt: z.string().min(1),
});
export type ActionConfig = z.infer<typeof actionSchema>;

const hiddenActionSchema = z.object({ id: z.string().min(1), hidden: z.literal(true) }).strict();

export const layerSchema = z
  .object({
    version: z.literal(1),
    tracker: trackerSchema.partial().strict().optional(),
    actions: z.array(z.union([hiddenActionSchema, actionSchema.strict()])).optional(),
  })
  .strict();
export type ConfigLayer = z.output<typeof layerSchema>;

export const effectiveConfigSchema = z.object({ tracker: trackerSchema, actions: z.array(actionSchema) });
export type EffectiveConfig = z.infer<typeof effectiveConfigSchema>;

// `skipped`: the whole layer was ignored. Otherwise it is a warning about a config that still applies.
export const configProblemSchema = z.object({ source: z.string(), message: z.string(), skipped: z.boolean() });
export type ConfigProblem = z.infer<typeof configProblemSchema>;

export const builtInConfig: EffectiveConfig = effectiveConfigSchema.parse({
  tracker: {
    folder: ".scratch",
    statuses: [
      { name: "in-progress", section: "inFlight" },
      { name: "in-review", section: "inFlight" },
      { name: "ready-for-agent", section: "ready" },
      { name: "ready-for-human", section: "yours" },
      { name: "needs-triage", section: "later" },
      { name: "needs-info", section: "later" },
      { name: "done", section: "done" },
      { name: "closed", section: "done" },
      { name: "wontfix", section: "done" },
    ],
    planningLabelPrefix: "wayfinder:",
  },
  actions: [
    {
      id: "pick",
      label: "Pick",
      showFor: { statuses: ["ready-for-agent"], planning: "exclude" },
      runIn: "worktree",
      setStatus: "in-progress",
      prompt:
        'Work on the task described in {issue}: read it and everything it links, build it and test it. The file lives in the main checkout at {project}, so edit it at that exact path. When it is done, set its Status to closed and add a short note under "## Comments" on what was built.',
    },
    {
      id: "help",
      label: "Help me",
      showFor: { statuses: ["ready-for-human"], planning: "exclude" },
      runIn: "project",
      prompt:
        'Help me do {issue}. Walk me through it one step at a time and do the parts you can yourself. When it is finished, set its Status to closed and add a short note under "## Comments".',
    },
    {
      id: "plan",
      label: "Plan it",
      showFor: { statuses: ["needs-triage"], planning: "exclude" },
      runIn: "project",
      prompt:
        "Help me turn {issue} into a plan: ask me what you need, then split it into ready-to-build issues in the same folder.",
    },
    {
      id: "decide",
      label: "Help me decide",
      showFor: { planning: "only" },
      runIn: "project",
      prompt: "Help me decide {issue}. Ask me questions until the decision is clear, then record it in the file.",
    },
  ],
});

// An action that matches neither shape fails as a bare "invalid input" union; its reason lives in the
// last branch (a full action, since `{ id, hidden }` comes first), so that branch's issue is reported.
const describeIssue = (issue: z.core.$ZodIssue, path: readonly PropertyKey[]): string => {
  const fullPath = [...path, ...issue.path];
  const branches = issue.code === "invalid_union" ? issue.errors : [];
  const lastBranch = branches[branches.length - 1];
  if (lastBranch && lastBranch.length > 0) {
    return describeIssue(lastBranch[0], fullPath);
  }
  const where = fullPath.length > 0 ? `${fullPath.map(String).join(".")}: ` : "";
  return `${where}${issue.message}`;
};

const firstIssue = (error: z.ZodError) => describeIssue(error.issues[0], []);

// Layers apply in order. Tracker fields override one by one; actions merge by id, so the same id
// replaces an action in place, a new id is appended, and `hidden: true` removes one. A layer that
// fails validation is skipped whole and reported, so one broken file never half-applies.
export const mergeConfig = (layers: readonly { source: string; value: unknown }[]) => {
  const problems: ConfigProblem[] = [];
  let tracker = builtInConfig.tracker;
  let actions = [...builtInConfig.actions];

  for (const { source, value } of layers) {
    if (value === undefined || value === null) {
      continue;
    }
    const parsed = layerSchema.safeParse(value);
    if (!parsed.success) {
      problems.push({ source, message: firstIssue(parsed.error), skipped: true });
      continue;
    }
    tracker = { ...tracker, ...parsed.data.tracker };
    for (const action of parsed.data.actions ?? []) {
      const index = actions.findIndex((existing) => existing.id === action.id);
      if ("hidden" in action) {
        actions = actions.filter((existing) => existing.id !== action.id);
      } else if (index === -1) {
        actions = [...actions, action];
      } else {
        actions = actions.map((existing, position) => (position === index ? action : existing));
      }
    }
  }
  return { config: { tracker, actions }, problems: [...problems, ...unknownStatuses(tracker, actions)] };
};

// Not fatal, since the rest of the config is fine, but an action naming a status the tracker
// doesn't know never shows, or fails when it starts, so it is reported next to layer problems.
const unknownStatuses = (tracker: TrackerConfig, actions: readonly ActionConfig[]): ConfigProblem[] => {
  const known = new Set(tracker.statuses.map((status) => status.name));
  return actions.flatMap((action) => {
    const named = [...(action.showFor.statuses ?? []), ...(action.setStatus ? [action.setStatus] : [])];
    const missing = [...new Set(named.filter((status) => !known.has(status)))];
    return missing.length === 0
      ? []
      : [
          {
            source: `action "${action.id}"`,
            message: `uses statuses the tracker doesn't list: ${missing.join(", ")}`,
            skipped: false,
          },
        ];
  });
};

export const sectionOf = (tracker: TrackerConfig, status: string) =>
  tracker.statuses.find((entry) => entry.name === status)?.section ?? "later";

export const isDoneStatus = (tracker: TrackerConfig, status: string) => sectionOf(tracker, status) === "done";

export const appliesTo = (
  action: ActionConfig,
  tracker: TrackerConfig,
  card: { status: string; isPlanning: boolean; isBlocked: boolean },
) => {
  const { statuses, planning, blocked } = action.showFor;
  const statusMatches = statuses ? statuses.includes(card.status) : !isDoneStatus(tracker, card.status);
  const planningMatches = planning === "any" || (planning === "only") === card.isPlanning;
  return statusMatches && planningMatches && (blocked || !card.isBlocked);
};

// Fills `{name}` placeholders; unknown ones are left as written so a typo is visible in the prompt.
export const renderTemplate = (template: string, values: Readonly<Record<string, string>>) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
