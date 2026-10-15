import { describe, expect, it } from "vitest";
import { helpPrompt, pickPrompt } from "./prompts";

const path = "/repo/.scratch/freya/issues/04-a.md";

describe("pickPrompt", () => {
  it("hands the absolute issue path to /implement", () => {
    expect(pickPrompt(path)).toMatch(/^\/implement \/repo\/\.scratch\/freya\/issues\/04-a\.md /);
  });
});

describe("helpPrompt", () => {
  it("walks through human tasks", () => {
    expect(helpPrompt({ status: "ready-for-human", isPlanning: false }, path, null)).toMatch(/^Help me do \/repo/);
  });

  it("plans triage issues", () => {
    expect(helpPrompt({ status: "needs-triage", isPlanning: false }, path, null)).toMatch(/^Help me turn \/repo/);
  });

  it("runs wayfinder on planning issues when the effort has a map", () => {
    expect(helpPrompt({ status: "ready-for-agent", isPlanning: true }, path, "/repo/.scratch/freya/map.md")).toBe(
      "/wayfinder /repo/.scratch/freya/map.md",
    );
  });
});
