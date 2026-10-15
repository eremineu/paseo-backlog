import { describe, expect, it } from "vitest";
import { type CatalogProvider, resolveAgentChoice } from "./agent-choice";

const catalog: CatalogProvider[] = [
  {
    provider: "claude",
    label: "Claude",
    models: [
      { id: "opus", label: "Opus", isDefault: true },
      { id: "sonnet", label: "Sonnet", isDefault: false },
    ],
    modes: [
      { id: "default", label: "Always Ask" },
      { id: "auto", label: "Auto" },
    ],
    defaultModeId: "default",
  },
  {
    provider: "codex",
    label: "Codex",
    models: [{ id: "gpt", label: "GPT", isDefault: false }],
    modes: [],
    defaultModeId: null,
  },
];

describe("resolveAgentChoice", () => {
  it("keeps a valid saved choice", () => {
    expect(resolveAgentChoice(catalog, { provider: "claude", model: "sonnet", modeId: "auto" })).toEqual({
      provider: "claude",
      model: "sonnet",
      modeId: "auto",
    });
  });

  it("falls back to the provider defaults for empty or unknown values", () => {
    expect(resolveAgentChoice(catalog, { provider: "claude", model: "", modeId: "gone" })).toEqual({
      provider: "claude",
      model: "opus",
      modeId: "default",
    });
  });

  it("takes the first model when none is marked default", () => {
    expect(resolveAgentChoice(catalog, { provider: "codex", model: "", modeId: "" })).toEqual({
      provider: "codex",
      model: "gpt",
      modeId: null,
    });
  });

  it("returns null when no provider is available", () => {
    expect(resolveAgentChoice([], { provider: "claude", model: "", modeId: "" })).toBeNull();
  });
});
