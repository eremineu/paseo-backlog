import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type ConfigProblem, mergeConfig } from "../shared/config";

const personalSource = "Settings → Plugins → Backlog";

type LayerRead = { layer: { source: string; value: unknown } | null; problem: ConfigProblem | null };

const problemOf = (source: string, error: unknown): LayerRead => ({
  layer: null,
  problem: { source, message: error instanceof Error ? error.message : String(error), skipped: true },
});

const parseLayer = (source: string, text: string, pick: (value: unknown) => unknown = (value) => value): LayerRead => {
  try {
    return { layer: { source, value: pick(JSON.parse(text)) }, problem: null };
  } catch (error) {
    return problemOf(source, error);
  }
};

const backlogKey = (value: unknown) =>
  value !== null && typeof value === "object" ? Reflect.get(value, "backlog") : undefined;

// A missing file is no layer; any other read failure is reported like a broken one.
export const readRepoLayer = async (projectRoot: string): Promise<LayerRead> => {
  const path = join(projectRoot, "paseo.json");
  const source = `${path} → backlog`;
  try {
    return parseLayer(source, await readFile(path, "utf8"), backlogKey);
  } catch (error) {
    const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
    return missing ? { layer: null, problem: null } : problemOf(source, error);
  }
};

const personalLayer = (json: string): LayerRead =>
  json.trim() === "" ? { layer: null, problem: null } : parseLayer(personalSource, json);

const merge = (reads: readonly LayerRead[]) => {
  const { config, problems } = mergeConfig(reads.flatMap((read) => (read.layer ? [read.layer] : [])));
  const unreadable = reads.flatMap((read) => (read.problem ? [read.problem] : []));
  return { config, problems: [...unreadable, ...problems] };
};

// Built-in defaults, then the repo's `paseo.json` → `backlog`, then the person's own settings.
export const loadConfig = async (projectRoot: string, personalJson: string) =>
  merge([await readRepoLayer(projectRoot), personalLayer(personalJson)]);

export const previewConfig = async (projectRoot: string | null, personalJson: string) => {
  if (!projectRoot) {
    return { repo: null, ...merge([personalLayer(personalJson)]) };
  }
  const repo = await readRepoLayer(projectRoot);
  const source = `${projectRoot}/paseo.json → backlog`;
  return {
    repo: { source, value: repo.layer?.value ?? null, problem: repo.problem?.message ?? null },
    ...merge([repo, personalLayer(personalJson)]),
  };
};

// A personal draft on its own, for the settings editor: no project is in view there.
export const checkPersonalConfig = (json: string) => merge([personalLayer(json)]);
