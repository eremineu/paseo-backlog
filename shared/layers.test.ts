import { describe, expect, it } from "vitest";
import { builtInConfig, mergeConfig } from "./config";
import {
  describeActions,
  layerToJson,
  parseLayer,
  uniqueActionId,
  withAction,
  withHidden,
  withTracker,
  withoutEntry,
} from "./layers";

const [pick] = builtInConfig.actions;
const layer = (value: object) => {
  const parsed = parseLayer({ version: 1, ...value });
  if (!parsed) {
    throw new Error("invalid test layer");
  }
  return parsed;
};

describe("describeActions", () => {
  it("lists built-in actions when no layer changes them", () => {
    expect(describeActions(null, null).map((row) => [row.id, row.origin])).toEqual([
      ["pick", "built-in"],
      ["help", "built-in"],
      ["plan", "built-in"],
      ["decide", "built-in"],
    ]);
  });

  it("tracks overrides, additions and hiding across layers", () => {
    const repo = layer({ actions: [{ ...pick, label: "Ship" }, { id: "plan", hidden: true }] });
    const personal = layer({
      actions: [
        { ...pick, label: "Mine" },
        { id: "help", hidden: true },
        { ...pick, id: "review", label: "Review" },
      ],
    });

    const rows = describeActions(repo, personal);

    expect(rows.find((row) => row.id === "pick")).toMatchObject({ origin: "personal", overridesLower: true });
    expect(rows.find((row) => row.id === "pick")?.action.label).toBe("Mine");
    expect(rows.find((row) => row.id === "plan")?.hiddenBy).toBe("repo");
    expect(rows.find((row) => row.id === "help")?.hiddenBy).toBe("personal");
    expect(rows.find((row) => row.id === "review")).toMatchObject({ origin: "personal", overridesLower: false });
  });

  it("agrees with the merge about what is visible", () => {
    const repo = layer({ actions: [{ id: "plan", hidden: true }] });
    const personal = layer({ actions: [{ ...pick, id: "extra", label: "Extra" }] });
    const visible = describeActions(repo, personal).filter((row) => !row.hiddenBy);
    const { config } = mergeConfig([
      { source: "repo", value: repo },
      { source: "personal", value: personal },
    ]);

    expect(visible.map((row) => row.id)).toEqual(config.actions.map((action) => action.id));
  });
});

describe("personal layer edits", () => {
  it("adds, replaces, hides and resets actions by id", () => {
    const added = withAction(null, { ...pick, label: "Mine" });
    const replaced = withAction(added, { ...pick, label: "Mine again" });
    const hidden = withHidden(replaced, "pick");

    expect(replaced.actions).toHaveLength(1);
    expect(replaced.actions?.[0]).toMatchObject({ label: "Mine again" });
    expect(hidden.actions).toEqual([{ id: "pick", hidden: true }]);
    expect(withoutEntry(hidden, "pick").actions).toEqual([]);
  });

  it("sets tracker fields and drops the section when nothing is left", () => {
    const set = withTracker(null, { folder: "backlog" });

    expect(set.tracker).toEqual({ folder: "backlog" });
    expect(withTracker(set, { folder: undefined }).tracker).toBeUndefined();
  });

  it("writes an empty layer as no config at all", () => {
    expect(layerToJson(withoutEntry(withHidden(null, "pick"), "pick"))).toBe("");
    expect(JSON.parse(layerToJson(withHidden(null, "pick")))).toEqual({ version: 1, actions: [{ id: "pick", hidden: true }] });
  });
});

describe("uniqueActionId", () => {
  it("derives an id from the label and avoids taken ones", () => {
    expect(uniqueActionId("Ship it!", [])).toBe("ship-it");
    expect(uniqueActionId("Pick", ["pick", "pick-2"])).toBe("pick-3");
    expect(uniqueActionId("???", [])).toBe("action");
  });
});
