import { z } from "zod";

export const statuses = [
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "in-progress",
  "in-review",
  "done",
  "closed",
  "wontfix",
] as const;

export const statusSchema = z.enum(statuses);
export type Status = z.infer<typeof statusSchema>;

const doneStatuses: ReadonlySet<string> = new Set(["closed", "done", "wontfix"]);
const laterStatuses: ReadonlySet<string> = new Set(["needs-triage", "needs-info"]);
const inFlightStatuses: ReadonlySet<string> = new Set(["in-progress", "in-review"]);
const knownStatuses: ReadonlySet<string> = new Set(statuses);

export const issueSchema = z.object({
  id: z.string(),
  file: z.string(),
  title: z.string(),
  status: z.string(),
  assignee: z.string(),
  labels: z.array(z.string()),
  blockers: z.array(z.string()),
  isPlanning: z.boolean(),
  summary: z.string(),
});
export type Issue = z.infer<typeof issueSchema>;

export const cardSchema = issueSchema.extend({
  waitingFor: z.array(z.object({ id: z.string(), title: z.string() })),
  canPick: z.boolean(),
  canHelp: z.boolean(),
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
    title: (lines.find((line) => line.startsWith("# ")) ?? `# ${file}`).slice(2).trim(),    status: headerField(lines, "Status").toLowerCase() || "needs-triage",
    assignee: headerField(lines, "Assignee"),
    labels,
    blockers: parseBlockers(headerField(lines, "Blocked by")),
    isPlanning: labels.some((label) => label.startsWith("wayfinder:")),
    summary: firstParagraph(body),
  };
};

export const isDone = (status: string) => doneStatuses.has(status);

export const buildBoard = (issues: readonly Issue[]): Board => {
  const byId = new Map(issues.map((issue) => [issueKey(issue.id), issue]));
  const openBlockers = (issue: Issue) =>
    issue.blockers
      .map((id) => byId.get(id))
      .filter((blocker): blocker is Issue => blocker !== undefined && !isDone(blocker.status))
      .map(({ id, title }) => ({ id, title }));

  const cards: Card[] = issues.map((issue) => {
    const waitingFor = openBlockers(issue);
    const unblocked = waitingFor.length === 0;
    const isBuild = !issue.isPlanning;
    return {
      ...issue,
      waitingFor,
      canPick: isBuild && unblocked && issue.status === "ready-for-agent",
      canHelp:
        unblocked &&
        (issue.status === "ready-for-human" ||
          issue.status === "needs-triage" ||
          (issue.isPlanning && !isDone(issue.status))),
    };
  });

  const isActionable = (card: Card) => card.status === "ready-for-agent" || card.status === "ready-for-human";
  const isWaiting = (card: Card) => card.waitingFor.length > 0;
  const isOpenPlanning = (card: Card) =>
    card.isPlanning && !isDone(card.status) && !laterStatuses.has(card.status) && !inFlightStatuses.has(card.status);

  return {
    inFlight: cards.filter((card) => inFlightStatuses.has(card.status)),
    ready: cards.filter((card) => card.canPick),
    yours: cards.filter((card) => !isWaiting(card) && (card.status === "ready-for-human" || isOpenPlanning(card))),
    waiting: cards.filter((card) => isWaiting(card) && isActionable(card)),
    // A status outside the known set (`blocked`, `done (2026-10-01)`) still shows, so it can be fixed from its card.
    later: cards.filter((card) => laterStatuses.has(card.status) || !knownStatuses.has(card.status)),
    done: cards.filter((card) => isDone(card.status)),
  };
};

export const replaceStatus = (text: string, status: Status) => {
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
export type BranchType = (typeof branchTypes)[number];

export const branchNameFor = ({ type, scope, file }: { type: string; scope: string; file: string }) =>
  `${type}/${slugify(scope)}/${slugFromFile(file)}`;
