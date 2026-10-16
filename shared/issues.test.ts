import { describe, expect, it } from "vitest";
import { builtInConfig, mergeConfig } from "./config";
import {
  branchNameFor,
  buildBoard,
  parseBlockers,
  parseIssue,
  replaceStatus,
  scopeFromEffort,
  slugFromFile,
} from "./issues";

const issueText = (header: string, title = "Settings page shows the wrong totals") =>
  `# ${title}\n\n${header}\n\n## Problem\n\nThe tab shows team ratios.\n\n## Evidence\n\n- one\n`;

describe("parseIssue", () => {
  it("reads the header lines and the first paragraph", () => {
    const issue = parseIssue(
      "07-settings-totals.md",
      issueText("Status: Ready-for-agent\nAssignee: unclaimed\nLabels: ui, web\nBlocked by: 01, 02"),
    );

    expect(issue).toMatchObject({
      id: "07",
      file: "07-settings-totals.md",
      title: "Settings page shows the wrong totals",
      status: "ready-for-agent",
      assignee: "unclaimed",
      labels: ["ui", "web"],
      blockers: ["1", "2"],
      summary: "The tab shows team ratios.",
    });
  });

  it("accepts the bold header form", () => {
    const issue = parseIssue("01-a.md", issueText("**Status:** in-review"));

    expect(issue.status).toBe("in-review");
  });

  it("treats an issue without a status as needs-triage", () => {
    expect(parseIssue("01-a.md", issueText("Assignee: me")).status).toBe("needs-triage");
  });

  it("reads files with CRLF line endings", () => {
    const issue = parseIssue("01-a.md", "# A\r\n\r\nStatus: in-review\r\nBlocked by: 02\r\n");

    expect(issue).toMatchObject({ title: "A", status: "in-review", blockers: ["2"] });
  });

  it("keeps labels for the board to classify", () => {
    expect(parseIssue("01-a.md", issueText("Labels: wayfinder:grilling")).labels).toEqual(["wayfinder:grilling"]);
  });
});

describe("parseBlockers", () => {
  it.each([
    ["none", []],
    ["none (02-reptile-api closed)", []],
    ["06-plug-into-company-wide-mcp", ["6"]],
    ["09 How the modules differ (closed), 17 Login audit (closed)", ["9", "17"]],
    ["#01; [03: Title](03-title.md)", ["1", "3"]],
    ["see [the spike](./04-spike.md)", ["4"]],
  ])("%s", (text, expected) => {
    expect(parseBlockers(text)).toEqual(expected);
  });
});

describe("buildBoard", () => {
  const issues = [
    parseIssue("01-done.md", issueText("Status: closed")),
    parseIssue("02-ready.md", issueText("Status: ready-for-agent\nBlocked by: 01")),
    parseIssue("03-blocked.md", issueText("Status: ready-for-agent\nBlocked by: 02")),
    parseIssue("04-human.md", issueText("Status: ready-for-human")),
    parseIssue("05-triage.md", issueText("Status: needs-triage")),
    parseIssue("06-wip.md", issueText("Status: in-progress")),
    parseIssue("07-plan.md", issueText("Status: ready-for-agent\nLabels: wayfinder:research")),
  ];
  const board = buildBoard(issues, builtInConfig);
  const ids = (cards: readonly { id: string }[]) => cards.map((card) => card.id);

  it("groups issues into sections", () => {
    expect(ids(board.inFlight)).toEqual(["06"]);
    expect(ids(board.ready)).toEqual(["02"]);
    expect(ids(board.waiting)).toEqual(["03"]);
    expect(ids(board.yours)).toEqual(["04", "07"]);
    expect(ids(board.later)).toEqual(["05"]);
    expect(ids(board.done)).toEqual(["01"]);
  });

  it("keeps an issue with an unknown status on the board", () => {
    const unknown = buildBoard([parseIssue("09-odd.md", issueText("Status: blocked"))], builtInConfig);

    expect(ids(unknown.later)).toEqual(["09"]);
  });

  it("lists open blockers and leaves closed ones out", () => {
    expect(board.waiting[0].waitingFor).toEqual([{ id: "02", title: "Settings page shows the wrong totals" }]);
    expect(board.ready[0].waitingFor).toEqual([]);
  });

  it("lists the actions that apply to each card, in config order", () => {
    const all = [...board.inFlight, ...board.ready, ...board.waiting, ...board.yours, ...board.later, ...board.done];
    const actionsById = Object.fromEntries(all.map((card) => [card.id, card.actionIds]));

    expect(actionsById).toEqual({
      "01": [],
      "02": ["pick"],
      "03": [],
      "04": ["help"],
      "05": ["plan"],
      "06": [],
      "07": ["decide"],
    });
  });

  it("uses the configured statuses and planning label", () => {
    const { config } = mergeConfig([
      {
        source: "test",
        value: {
          version: 1,
          tracker: { statuses: [{ name: "todo", section: "ready" }], planningLabelPrefix: "spike" },
        },
      },
    ]);
    const custom = buildBoard(
      [parseIssue("01-a.md", issueText("Status: todo")), parseIssue("02-b.md", issueText("Status: todo\nLabels: spike"))],
      config,
    );

    expect(ids(custom.ready)).toEqual(["01"]);
    expect(ids(custom.yours)).toEqual(["02"]);
  });
});

describe("replaceStatus", () => {
  it("rewrites only the status line", () => {
    const text = issueText("Status: ready-for-agent\nAssignee: unclaimed");

    expect(replaceStatus(text, "in-progress")).toBe(issueText("Status: in-progress\nAssignee: unclaimed"));
  });

  it("keeps the bold form", () => {
    expect(replaceStatus(issueText("**Status:** done"), "closed")).toBe(issueText("**Status:** closed"));
  });

  it("adds a status line under the title when there is none", () => {
    expect(replaceStatus("# Title\n\nBody\n", "needs-info")).toBe("# Title\n\nStatus: needs-info\n\nBody\n");
  });

  it("keeps CRLF line endings", () => {
    expect(replaceStatus("# A\r\n\r\nStatus: done\r\n", "closed")).toBe("# A\r\n\r\nStatus: closed\r\n");
  });

  it("leaves a Status line in the body alone", () => {
    const text = "# Title\n\nStatus: done\n\n## Notes\n\nStatus: something else\n";

    expect(replaceStatus(text, "closed")).toBe("# Title\n\nStatus: closed\n\n## Notes\n\nStatus: something else\n");
  });
});

describe("branch names", () => {
  it("takes the scope from the effort name prefix", () => {
    expect(scopeFromEffort("web-backlog")).toBe("web");
    expect(scopeFromEffort("player-scraper")).toBe("player");
    expect(scopeFromEffort("api")).toBe("api");
  });

  it("slugs the issue file", () => {
    expect(slugFromFile("07-settings-totals.md")).toBe("07-settings-totals");
    expect(slugFromFile("08 Weird Name!.md")).toBe("08-weird-name");
  });

  it("joins type, scope and slug", () => {
    expect(branchNameFor({ template: "{type}/{effortPrefix}/{slug}", type: "feat", scope: "web", effort: "web-backlog", file: "07-settings-totals.md" })).toBe(
      "feat/web/07-settings-totals",
    );
  });

  it("turns a typed scope into a valid ref segment", () => {
    expect(branchNameFor({ template: "{type}/{effortPrefix}/{slug}", type: "fix", scope: " Api/UI ", effort: "x", file: "01-a.md" })).toBe("fix/api-ui/01-a");
    expect(branchNameFor({ template: "work/{effort}-{id}", type: "feat", scope: "x", effort: "Web Backlog", file: "07-a.md" })).toBe("work/web-backlog-07");
    expect(scopeFromEffort("Foo_Bar-x")).toBe("foo-bar");
  });
});
