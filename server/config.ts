import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type ConfigProblem, mergeConfig } from "../shared/config";

const personalSource = "Settings → Plugins → Backlog";

type LayerRead = { layer: { source: string; value: unknown } | null; problem: ConfigProblem | null };

const parseLayer = (source: string, text: string, pick: (value: unknown) => unknown = (value) => value): LayerRead => {
  try {
    return { layer: { source, value: pick(JSON.parse(text)) }, problem: null };
  } catch (error) {
    return { layer: null, problem: { source, message: error instanceof Error ? error.message : String(error) } };
  }
};

const backlogKey = (value: unknown) =>
  value !== null && typeof value === "object" ? Reflect.get(value, "backlog") : undefined;

const personalLayer = (json: string): LayerRead =>
  json.trim() === "" ? { layer: null, problem: null } : parseLayer(personalSource, json);

const merge = (reads: readonly LayerRead[]) => {
  const { config, problems } = mergeConfig(reads.flatMap((read) => (read.layer ? [read.layer] : [])));
  const unreadable = reads.flatMap((read) => (read.problem ? [read.problem] : []));
  return { config, problems: [...unreadable, ...problems] };
};

// Built-in defaults, then the repo's `paseo.json` → `backlog`, then the person's own settings.
export const loadConfig = async (projectRoot: string, personalJson: string) => {
  const repoPath = join(projectRoot, "paseo.json");
  const repo = existsSync(repoPath)
    ? parseLayer(`${repoPath} → backlog`, await readFile(repoPath, "utf8"), backlogKey)
    : { layer: null, problem: null };
  return merge([repo, personalLayer(personalJson)]);
};

// A personal draft on its own, for the settings editor: no project is in view there.
export const checkPersonalConfig = (json: string) => merge([personalLayer(json)]);
