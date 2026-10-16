import { type ActionConfig, type ConfigLayer, type TrackerConfig, builtInConfig, layerSchema } from "./config";

export type Origin = "built-in" | "repo" | "personal";

export interface ActionRow {
  id: string;
  // The definition that wins; a hidden action keeps the one it would have had.
  action: ActionConfig;
  origin: Origin;
  // The personal layer holds its own copy of an action a lower layer defines, so Reset brings that one back.
  overridesLower: boolean;
  hiddenBy: Origin | null;
}

export const parseLayer = (value: unknown): ConfigLayer | null => {
  const parsed = layerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

// Every action across the layers, in merge order, with where its winning definition came from.
export const describeActions = (repo: ConfigLayer | null, personal: ConfigLayer | null): ActionRow[] => {
  const rows: ActionRow[] = builtInConfig.actions.map((action) => ({
    id: action.id,
    action,
    origin: "built-in",
    overridesLower: false,
    hiddenBy: null,
  }));
  const layers: [Origin, ConfigLayer | null][] = [
    ["repo", repo],
    ["personal", personal],
  ];
  for (const [origin, layer] of layers) {
    for (const entry of layer?.actions ?? []) {
      const row = rows.find((candidate) => candidate.id === entry.id);
      if ("hidden" in entry) {
        if (row) {
          row.hiddenBy = origin;
        }
      } else if (row) {
        row.overridesLower = origin === "personal" && row.origin !== "personal";
        row.action = entry;
        row.origin = origin;
        row.hiddenBy = null;
      } else {
        rows.push({ id: entry.id, action: entry, origin, overridesLower: false, hiddenBy: null });
      }
    }
  }
  return rows;
};

const emptyLayer = (): ConfigLayer => ({ version: 1 });

const replaceEntry = (
  layer: ConfigLayer | null,
  id: string,
  entry: NonNullable<ConfigLayer["actions"]>[number] | null,
): ConfigLayer => {
  const base = layer ?? emptyLayer();
  const actions = base.actions ?? [];
  const index = actions.findIndex((existing) => existing.id === id);
  const kept = actions.filter((existing) => existing.id !== id);
  if (!entry) {
    return { ...base, actions: kept };
  }
  const next = index === -1 ? [...kept, entry] : actions.map((existing) => (existing.id === id ? entry : existing));
  return { ...base, actions: next };
};

export const withAction = (layer: ConfigLayer | null, action: ActionConfig) => replaceEntry(layer, action.id, action);

export const withHidden = (layer: ConfigLayer | null, id: string) =>
  replaceEntry(layer, id, { id, hidden: true as const });

// Drops the personal entry for an action, so the team's or built-in version applies again.
export const withoutEntry = (layer: ConfigLayer | null, id: string) => replaceEntry(layer, id, null);

export const withTracker = (layer: ConfigLayer | null, tracker: Partial<TrackerConfig>): ConfigLayer => {
  const base = layer ?? emptyLayer();
  const kept = Object.fromEntries(Object.entries(tracker).filter(([, value]) => value !== undefined));
  return Object.keys(kept).length === 0 ? { version: base.version, actions: base.actions } : { ...base, tracker: kept };
};

export const layerToJson = (layer: ConfigLayer) => {
  const isEmpty = (layer.actions ?? []).length === 0 && !layer.tracker;
  return isEmpty ? "" : JSON.stringify(layer, null, 2);
};

export const uniqueActionId = (label: string, taken: readonly string[]) => {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "action";
  let candidate = base;
  for (let suffix = 2; taken.includes(candidate); suffix += 1) {
    candidate = `${base}-${suffix}`;
  }
  return candidate;
};
