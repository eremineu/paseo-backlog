import { z } from "zod";
import { type EffectiveConfig, appliesTo, isDoneStatus, renderTemplate, sectionOf } from "./config";

export const issueSchema = z.object({
  id: z.string(),
  file: z.string(),
  title: z.string(),
  status: z.string(),
  assignee: z.string(),
  labels: z.array(z.string()),
  blockers: z.array(z.string()),
  summary: z.string(),
});
export type Issue = z.infer<typeof issueSchema>;

export const cardSchema = issueSchema.extend({
  isPlanning: z.boolean(),
  waitingFor: z.array(z.object({ id: z.string(), title: z.string() })),
  // Ids of the configured actions that apply, in config order; the first is the card's button.
  actionIds: z.array(z.string()),
});
export type Card = z.infer<typeof cardSchema>;

export const boardSchema = z.object({
  inFlight: z.array(cardSchema),
  ready: z.array(cardSchema),
  yours: z.array(cardSchema),
  waiting: z.array(cardSchema),
  later: z.array(cardSchema),
  done: z.array(cardSchema),
});
export type Board = z.infer<typeof boardSchema>;

// Reads `Name: value`, also in the bold `**Name:** value` form that ticket templates use.
// The value stops before a `\r`, so files with CRLF line endings parse and keep their endings on rewrite.
const headerPattern = (name: string) => new RegExp(`^(\\*{0,2}${name}:\\*{0,2})([^\\r]*)`);

const headerField = (lines: readonly string[], name: string) => {
  const pattern = headerPattern(name);
  const line = headerLines(lines).find((candidate) => pattern.test(candidate));
  if (!line) {
    return "";
  }
  return line.replace(pattern, "$2").trim();
};

// Header fields live between the title and the first `## ` section.
const headerLines = (lines: readonly string[]) => {
  const end = lines.findIndex((line) => line.startsWith("## "));
  return end === -1 ? lines : lines.slice(0, end);
};

// Issue numbers compare by value, so `1`, `01` and `#01` name the same issue.
const issueKey = (id: string) => (/^\d+$/.test(id) ? String(Number(id)) : id);

// A blocker is a comma-separated item that starts with an issue number (`01`, `#01`, `[01: Title](...)`)
// or links to a sibling `NN-*.md` file. Anything else, like `none`, blocks nothing.
export const parseBlockers = (text: string) => {
  const ids = text
    .split(/[,;]/)
    .map((item) => item.trim().match(/^\[?#?(\d+)\b/) ?? item.match(/\]\((?:\.\/)?(\d+)[^)]*\.md\)/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => issueKey(match[1]));
  return [...new Set(ids)];
};

const firstParagraph = (body: string) => {
  const lines = body.split("\n").slice(1);
  const start = lines.findIndex((line) => line.trim() !== "");
  if (start === -1) {
    return "";
  }
  // The summary is the opening prose only: it stops at a blank line or where a list or table begins.
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.trim() === "" || /^\s*(- |\d+\. |\|)/.test(line));
  const paragraph = [lines[start], ...rest.slice(0, end === -1 ? undefined : end)].join(" ");
  const plain = paragraph
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*`]/g, "")
    .replace(/^- /, "");
  return plain.length > 260 ? `${plain.slice(0, 257)}…` : plain;
};

export const parseIssue = (file: string, text: string): Issue => {
  const lines = text.split("\n");
  const labels = headerField(lines, "Labels")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  const bodyStart = lines.findIndex((line) => line.startsWith("## "));
  const body = bodyStart === -1 ? "" : lines.slice(bodyStart).join("\n");
  return {
    id: file.match(/^(\d+)/)?.[1] ?? file,
    file,
    title: (lines.find((line) => line.startsWith("# ")) ?? `# ${file}`).slice(2).trim(),
    status: headerField(lines, "Status").toLowerCase() || "needs-triage",
    assignee: headerField(lines, "Assignee"),
    labels,
    blockers: parseBlockers(headerField(lines, "Blocked by")),
    summary: firstParagraph(body),
  };
};

export const buildBoard = (issues: readonly Issue[], config: EffectiveConfig): Board => {
  const { tracker } = config;
  const byId = new Map(issues.map((issue) => [issueKey(issue.id), issue]));
  const openBlockers = (issue: Issue) =>
    issue.blockers
      .map((id) => byId.get(id))
      .filter((blocker): blocker is Issue => blocker !== undefined && !isDoneStatus(tracker, blocker.status))
      .map(({ id, title }) => ({ id, title }));

  const cards: Card[] = issues.map((issue) => {
    const waitingFor = openBlockers(issue);
    const isPlanning =
      tracker.planningLabelPrefix !== "" && issue.labels.some((label) => label.startsWith(tracker.planningLabelPrefix));
    const facts = { status: issue.status, isPlanning, isBlocked: waitingFor.length > 0 };
    return {
      ...issue,
      isPlanning,
      waitingFor,
      actionIds: config.actions.filter((action) => appliesTo(action, tracker, facts)).map((action) => action.id),
    };
  });

  const sectionFor = (card: Card) => {
    const section = sectionOf(tracker, card.status);
    const isActionable = section === "ready" || section === "yours";
    if (isActionable && card.waitingFor.length > 0) {
      return "waiting";
    }
    // Planning work is a decision for a person, even when its status says an agent could pick it.
    if (section === "ready" && card.isPlanning) {
      return "yours";
    }
    return section;
  };

  const board: Board = { inFlight: [], ready: [], yours: [], waiting: [], later: [], done: [] };
  for (const card of cards) {
    board[sectionFor(card)].push(card);
  }
  return board;
};

export const replaceStatus = (text: string, status: string) => {
  const lines = text.split("\n");
  const pattern = headerPattern("Status");
  const headerEnd = headerLines(lines).length;
  const index = lines.findIndex((line, position) => position < headerEnd && pattern.test(line));
  if (index !== -1) {
    lines[index] = lines[index].replace(pattern, (_, prefix: string) => `${prefix} ${status}`);
    return lines.join("\n");
  }
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  lines.splice(titleIndex + 1, 0, "", `Status: ${status}`);
  return lines.join("\n");
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const scopeFromEffort = (effort: string) => slugify(effort.split("-")[0]);

export const slugFromFile = (file: string) => slugify(file.replace(/\.md$/, ""));

export const branchTypes = ["feat", "fix", "chore", "refactor", "docs", "test", "perf", "ci"] as const;

// Each placeholder becomes a valid ref segment; the template's own slashes and literal text stay as written.
export const branchNameFor = ({
  template,
  type,
  scope,
  effort,
  file,
}: {
  template: string;
  type: string;
  scope: string;
  effort: string;
  file: string;
}) =>
  renderTemplate(template, {
    type: slugify(type),
    effortPrefix: slugify(scope),
    effort: slugify(effort),
    slug: slugFromFile(file),
    id: slugify(file.match(/^(\d+)/)?.[1] ?? slugFromFile(file)),
  });
