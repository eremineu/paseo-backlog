import { describe, expect, it } from "vitest";
import { appliesTo, builtInConfig, mergeConfig, renderTemplate, sectionOf } from "./config";

const ids = (actions: readonly { id: string }[]) => actions.map((action) => action.id);
const action = (id: string, extra: object = {}) => ({ id, label: id, runIn: "project", prompt: `do ${id}`, ...extra });

describe("mergeConfig", () => {
  it("returns the built-in config with no layers", () => {
    expect(mergeConfig([])).toEqual({ config: builtInConfig, problems: [] });
  });

  it("replaces an action by id in place, appends new ones and hides others", () => {
    const { config, problems } = mergeConfig([
      {
        source: "paseo.json",
        value: { version: 1, actions: [action("pick", { label: "Ship" }), action("review"), { id: "plan", hidden: true }] },
      },
    ]);

    expect(problems).toEqual([]);
    expect(ids(config.actions)).toEqual(["pick", "help", "decide", "review"]);
    expect(config.actions[0]).toMatchObject({ label: "Ship", runIn: "project", setStatus: null });
  });

  it("lets a later layer override an earlier one", () => {
    const { config } = mergeConfig([
      { source: "paseo.json", value: { version: 1, actions: [action("pick", { label: "Team pick" })] } },
      { source: "personal", value: { version: 1, actions: [action("pick", { label: "My pick" })] } },
    ]);

    expect(config.actions.find((entry) => entry.id === "pick")?.label).toBe("My pick");
  });

  it("overrides tracker fields one by one", () => {
    const { config } = mergeConfig([{ source: "paseo.json", value: { version: 1, tracker: { folder: "backlog" } } }]);

    expect(config.tracker.folder).toBe("backlog");
    expect(config.tracker.planningLabelPrefix).toBe("wayfinder:");
  });

  it("skips an invalid layer whole and reports where it broke", () => {
    const { config, problems } = mergeConfig([
      { source: "paseo.json", value: { version: 1, actions: [action("extra"), { id: "pick", label: "" }] } },
      { source: "personal", value: { version: 2 } },
    ]);

    expect(ids(config.actions)).toEqual(ids(builtInConfig.actions));
    expect(problems.map((problem) => problem.source)).toEqual(["paseo.json", "personal"]);
    expect(problems[0].message).toMatch(/^actions\.1/);
  });

  it("refuses a tracker folder outside the project", () => {
    const { problems } = mergeConfig([{ source: "paseo.json", value: { version: 1, tracker: { folder: "../elsewhere" } } }]);

    expect(problems[0].message).toMatch(/inside the project/);
  });

  it("names the missing field of a broken action", () => {
    const { problems } = mergeConfig([{ source: "personal", value: { version: 1, actions: [{ id: "x" }] } }]);

    expect(problems[0].message).toMatch(/^actions\.0\.(label|runIn|prompt): /);
  });

  it("rejects unknown keys so typos don't pass silently", () => {
    const { problems } = mergeConfig([{ source: "personal", value: { version: 1, action: [] } }]);

    expect(problems).toHaveLength(1);
  });
});

describe("appliesTo", () => {
  const tracker = builtInConfig.tracker;
  const [pick, , , decide] = builtInConfig.actions;
  const card = { status: "ready-for-agent", isPlanning: false, isBlocked: false };

  it("matches listed statuses only", () => {
    expect(appliesTo(pick, tracker, card)).toBe(true);
    expect(appliesTo(pick, tracker, { ...card, status: "needs-info" })).toBe(false);
  });

  it("hides actions from blocked cards unless allowed", () => {
    expect(appliesTo(pick, tracker, { ...card, isBlocked: true })).toBe(false);
    expect(appliesTo({ ...pick, showFor: { ...pick.showFor, blocked: true } }, tracker, { ...card, isBlocked: true })).toBe(true);
  });

  it("follows the planning filter, and without statuses skips done issues", () => {
    expect(appliesTo(decide, tracker, { ...card, isPlanning: true })).toBe(true);
    expect(appliesTo(decide, tracker, card)).toBe(false);
    expect(appliesTo(decide, tracker, { ...card, isPlanning: true, status: "closed" })).toBe(false);
  });
});

describe("sectionOf", () => {
  it("sends unknown statuses to later", () => {
    expect(sectionOf(builtInConfig.tracker, "blocked")).toBe("later");
  });
});

describe("renderTemplate", () => {
  it("fills known placeholders and leaves unknown ones visible", () => {
    expect(renderTemplate("/ship {issue} on {branch} {oops}", { issue: "/a.md", branch: "feat/x" })).toBe(
      "/ship /a.md on feat/x {oops}",
    );
  });
});
