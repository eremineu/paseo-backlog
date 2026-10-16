import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { builtInConfig } from "../shared/config";
import { checkPersonalConfig, loadConfig } from "./config";
import { createLinkStore } from "./links";
import { createChangeFeed, listEfforts, readBoard, readIssue, setStatus } from "./tracker";

let root: string;

const writeIssue = async (effort: string, file: string, text: string) => {
  const dir = join(root, ".scratch", effort, "issues");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, file), text);
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "paseo-backlog-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("tracker", () => {
  it("lists efforts with issues, most recently changed first", async () => {
    await writeIssue("old", "01-a.md", "# A\n\nStatus: done\n");
    await writeIssue("new", "01-b.md", "# B\n\nStatus: done\n");
    await mkdir(join(root, ".scratch", "no-issues"));
    await utimes(join(root, ".scratch", "old", "issues"), new Date(2000, 1, 1), new Date(2000, 1, 1));

    expect(await listEfforts(root, ".scratch")).toEqual(["new", "old"]);
  });

  it("returns no efforts when the project has no tracker", async () => {
    expect(await listEfforts(root, ".scratch")).toEqual([]);
  });

  it("reads the board and the map", async () => {
    await writeIssue("web", "01-a.md", "# A\n\nStatus: ready-for-agent\n");
    await writeFile(join(root, ".scratch", "web", "map.md"), "# Map\n");

    const result = await readBoard(root, "web", builtInConfig);

    expect(result.board.ready.map((card) => card.id)).toEqual(["01"]);
    expect(result.mapPath).toBe(join(root, ".scratch", "web", "map.md"));
    expect(result.issuesDir).toBe(join(root, ".scratch", "web", "issues"));
  });

  it("writes a new status into the issue file", async () => {
    await writeIssue("web", "01-a.md", "# A\n\nStatus: ready-for-agent\nAssignee: me\n");

    await setStatus(root, builtInConfig, "web", "01-a.md", "in-progress");

    expect((await readIssue(root, ".scratch", "web", "01-a.md")).text).toBe("# A\n\nStatus: in-progress\nAssignee: me\n");
  });

  it.each([
    ["..", "01-a.md"],
    ["web", "../../secret.md"],
    ["web", "notes.txt"],
  ])("refuses paths outside the tracker (%s, %s)", async (effort, file) => {
    await expect(setStatus(root, builtInConfig, effort, file, "done")).rejects.toThrow();
  });

  it("refuses a status the config doesn't know", async () => {
    await writeIssue("web", "01-a.md", "# A\n\nStatus: ready-for-agent\n");

    await expect(setStatus(root, builtInConfig, "web", "01-a.md", "nonsense")).rejects.toThrow(/Unknown status/);
  });

  it("refuses a relative project root", async () => {
    await expect(listEfforts("relative/path", ".scratch")).rejects.toThrow();
  });
});

describe("change feed", () => {
  it("answers at once when the client is behind", async () => {
    await writeIssue("web", "01-a.md", "# A\n");
    const feed = createChangeFeed();

    expect(await feed.waitForChange(root, ".scratch", 0)).toEqual({ version: 1 });
    feed.close();
  });

  it("wakes a waiting client when an issue changes", async () => {
    await writeIssue("web", "01-a.md", "# A\n");
    const feed = createChangeFeed();
    await feed.waitForChange(root, ".scratch", 0);

    const waiting = feed.waitForChange(root, ".scratch", 1, 5_000);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    await writeIssue("web", "01-a.md", "# A\n\nStatus: done\n");

    expect((await waiting).version).toBeGreaterThan(1);
    feed.close();
  });

  it("reports a tracker created after the first poll", async () => {
    const feed = createChangeFeed();
    const { version } = await feed.waitForChange(root, ".scratch", 0);
    await writeIssue("web", "01-a.md", "# A\n");

    expect((await feed.waitForChange(root, ".scratch", version, 20)).version).toBeGreaterThan(version);
    feed.close();
  });

  it("wakes a waiting client when paseo.json changes", async () => {
    await writeIssue("web", "01-a.md", "# A\n");
    const feed = createChangeFeed();
    await feed.waitForChange(root, ".scratch", 0);
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    const { version } = await feed.waitForChange(root, ".scratch", -1);

    const waiting = feed.waitForChange(root, ".scratch", version, 5_000);
    await writeFile(join(root, "paseo.json"), "{}");

    expect((await waiting).version).toBeGreaterThan(version);
    feed.close();
  });

  it("returns the same version after a quiet stretch", async () => {
    await writeIssue("web", "01-a.md", "# A\n");
    const feed = createChangeFeed();
    await feed.waitForChange(root, ".scratch", 0);
    // macOS can still report the write made just before the watch started.
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    const { version } = await feed.waitForChange(root, ".scratch", -1);

    expect(await feed.waitForChange(root, ".scratch", version, 20)).toEqual({ version });
    feed.close();
  });
});

describe("config files", () => {
  const writePaseoJson = (value: unknown) => writeFile(join(root, "paseo.json"), JSON.stringify(value));

  it("uses the built-in config when nothing is set", async () => {
    expect(await loadConfig(root, "")).toEqual({ config: builtInConfig, problems: [] });
  });

  it("applies the repo layer, then the personal one", async () => {
    await writePaseoJson({
      scripts: {},
      backlog: { version: 1, tracker: { folder: "backlog" }, actions: [{ id: "pick", hidden: true }] },
    });
    const personal = JSON.stringify({ version: 1, tracker: { planningLabelPrefix: "spike" } });

    const { config, problems } = await loadConfig(root, personal);

    expect(problems).toEqual([]);
    expect(config.tracker).toMatchObject({ folder: "backlog", planningLabelPrefix: "spike" });
    expect(config.actions.map((action) => action.id)).not.toContain("pick");
  });

  it("names a broken paseo.json and keeps the personal layer", async () => {
    await writeFile(join(root, "paseo.json"), "{ broken");
    const personal = JSON.stringify({ version: 1, tracker: { folder: "mine" } });

    const { config, problems } = await loadConfig(root, personal);

    expect(config.tracker.folder).toBe("mine");
    expect(problems).toHaveLength(1);
    expect(problems[0].source).toContain(join(root, "paseo.json"));
  });

  it("checks a personal draft on its own", () => {
    expect(checkPersonalConfig("{").problems).toHaveLength(1);
    expect(checkPersonalConfig("").problems).toEqual([]);
  });
});

describe("link store", () => {
  it("recovers from a broken links file on the next save", async () => {
    const path = join(root, "links.json");
    await writeFile(path, "{ not json");
    const store = createLinkStore(path);
    const issuesDir = join(root, ".scratch", "web", "issues");

    expect(await store.linksUnder(issuesDir)).toEqual({});
    await store.save(join(issuesDir, "01-a.md"), { agentId: "a1", workspaceId: "w1" });
    expect(await store.linksUnder(issuesDir)).toEqual({ "01-a.md": { agentId: "a1", workspaceId: "w1" } });
  });

  it("keeps links per issue and returns them by file name", async () => {
    const store = createLinkStore(join(root, "state", "links.json"));
    const issuesDir = join(root, ".scratch", "web", "issues");

    await Promise.all([
      store.save(join(issuesDir, "01-a.md"), { agentId: "a1", workspaceId: "w1" }),
      store.save(join(issuesDir, "02-b.md"), { agentId: "a2", workspaceId: "w2" }),
      store.save(join(root, ".scratch", "other", "issues", "01-a.md"), { agentId: "a3", workspaceId: "w3" }),
    ]);

    expect(await store.linksUnder(issuesDir)).toEqual({
      "01-a.md": { agentId: "a1", workspaceId: "w1" },
      "02-b.md": { agentId: "a2", workspaceId: "w2" },
    });
    expect(JSON.parse(await readFile(join(root, "state", "links.json"), "utf8"))).toHaveProperty(
      [join(root, ".scratch", "other", "issues", "01-a.md")],
    );
  });
});
