import { describe, expect, it } from "vitest";
import {
  branchNameFor,
  buildBoard,
  parseBlockers,
  parseIssue,
  replaceStatus,
  scopeFromEffort,
  slugFromFile,
} from "./issues";

const issueText = (header: string, title = "Thor overview shows team data") =>
  `# ${title}\n\n${header}\n\n## Problem\n\nThe tab shows team ratios.\n\n## Evidence\n\n- one\n`;

describe("parseIssue", () => {
  it("reads the header lines and the first paragraph", () => {
    const issue = parseIssue(
      "07-thor-overview.md",
      issueText("Status: Ready-for-agent\nAssignee: unclaimed\nLabels: ui, freya\nBlocked by: 01, 02"),
    );

    expect(issue).toMatchObject({
      id: "07",
      file: "07-thor-overview.md",
      title: "Thor overview shows team data",
      status: "ready-for-agent",
      assignee: "unclaimed",
      labels: ["ui", "freya"],
      blockers: ["1", "2"],
      isPlanning: false,
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

  it("marks wayfinder issues as planning", () => {
    expect(parseIssue("01-a.md", issueText("Labels: wayfinder:grilling")).isPlanning).toBe(true);
  });
});

describe("parseBlockers", () => {
  it.each([
    ["none", []],
    ["none (02-reptile-api closed)", []],
    ["06-plug-into-company-wide-mcp", ["6"]],
    ["09 How the modules differ (closed), 17 Freya login audit (closed)", ["9", "17"]],
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
  const board = buildBoard(issues);
  const ids = (cards: readonly { id: string }[]) => cards.map((card) => card.id);

  it("groups issues into sections", () => {
    expect(ids(board.inFlight)).toEqual(["06"]);
    expect(ids(board.ready)).toEqual(["02"]);
    expect(ids(board.waiting)).toEqual(["03"]);
    expect(ids(board.yours)).toEqual(["04", "07"]);
    expect(ids(board.later)).toEqual(["05"]);
    expect(ids(board.done)).toEqual(["01"]);
  });

  it("lists open blockers and leaves closed ones out", () => {
    expect(board.waiting[0].waitingFor).toEqual([{ id: "02", title: "Thor overview shows team data" }]);
    expect(board.ready[0].waitingFor).toEqual([]);
  });

  it("offers Pick only on unblocked build tasks ready for an agent", () => {
    const pickable = [...board.ready, ...board.waiting, ...board.yours].filter((card) => card.canPick);

    expect(ids(pickable)).toEqual(["02"]);
  });

  it("offers Help me on human, triage and planning cards", () => {
    const all = [...board.inFlight, ...board.ready, ...board.waiting, ...board.yours, ...board.later, ...board.done];

    expect(ids(all.filter((card) => card.canHelp))).toEqual(["04", "07", "05"]);
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

  it("leaves a Status line in the body alone", () => {
    const text = "# Title\n\nStatus: done\n\n## Notes\n\nStatus: something else\n";

    expect(replaceStatus(text, "closed")).toBe("# Title\n\nStatus: closed\n\n## Notes\n\nStatus: something else\n");
  });
});

describe("branch names", () => {
  it("takes the scope from the effort name prefix", () => {
    expect(scopeFromEffort("freya-backlog")).toBe("freya");
    expect(scopeFromEffort("player-scraper")).toBe("player");
    expect(scopeFromEffort("raiden")).toBe("raiden");
  });

  it("slugs the issue file", () => {
    expect(slugFromFile("07-thor-overview.md")).toBe("07-thor-overview");
    expect(slugFromFile("08 Weird Name!.md")).toBe("08-weird-name");
  });

  it("joins type, scope and slug", () => {
    expect(branchNameFor({ type: "feat", scope: "freya", file: "07-thor-overview.md" })).toBe(
      "feat/freya/07-thor-overview",
    );
  });
});
