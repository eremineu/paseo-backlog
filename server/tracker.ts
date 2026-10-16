import { type FSWatcher, existsSync, watch } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { EffectiveConfig } from "../shared/config";
import { buildBoard, parseIssue, replaceStatus } from "../shared/issues";

const quietPollMs = 20_000;

// Effort and file names come from the client; anything that could leave `<tracker>/<effort>/issues/` is refused.
const assertName = (value: string, kind: string) => {
  if (value === "" || value.startsWith(".") || /[/\\]/.test(value)) {
    throw new Error(`Invalid ${kind}: ${value}`);
  }
};

export const assertProjectRoot = (projectRoot: string) => {
  if (!isAbsolute(projectRoot)) {
    throw new Error(`Project root must be absolute: ${projectRoot}`);
  }
};

const trackerDir = (projectRoot: string, folder: string) => join(projectRoot, folder);

export const issuesDirOf = (projectRoot: string, folder: string, effort: string) => {
  assertProjectRoot(projectRoot);
  assertName(effort, "effort");
  return join(trackerDir(projectRoot, folder), effort, "issues");
};

export const issuePathOf = (projectRoot: string, folder: string, effort: string, file: string) => {
  assertName(file, "issue file");
  if (!file.endsWith(".md")) {
    throw new Error(`Not an issue file: ${file}`);
  }
  return join(issuesDirOf(projectRoot, folder, effort), file);
};

// Efforts with an `issues/` folder, the most recently changed first.
export const listEfforts = async (projectRoot: string, folder: string) => {
  assertProjectRoot(projectRoot);
  const tracker = trackerDir(projectRoot, folder);
  if (!existsSync(tracker)) {
    return [];
  }
  const entries = await readdir(tracker, { withFileTypes: true });
  const efforts = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && existsSync(join(tracker, entry.name, "issues")))
      .map(async (entry) => ({
        name: entry.name,
        changedAt: (await stat(join(tracker, entry.name, "issues"))).mtimeMs,
      })),
  );
  return efforts.sort((a, b) => b.changedAt - a.changedAt).map((effort) => effort.name);
};

export const readBoard = async (projectRoot: string, effort: string, config: EffectiveConfig) => {
  const { folder } = config.tracker;
  const issuesDir = issuesDirOf(projectRoot, folder, effort);
  const files = existsSync(issuesDir) ? (await readdir(issuesDir)).filter((file) => file.endsWith(".md")).sort() : [];
  const issues = await Promise.all(
    files.map(async (file) => parseIssue(file, await readFile(join(issuesDir, file), "utf8"))),
  );
  const mapPath = join(trackerDir(projectRoot, folder), effort, "map.md");
  return {
    board: buildBoard(issues, config),
    issuesDir,
    mapPath: existsSync(mapPath) ? mapPath : null,
  };
};

export const readIssue = async (projectRoot: string, folder: string, effort: string, file: string) => {
  const path = issuePathOf(projectRoot, folder, effort, file);
  return { path, text: await readFile(path, "utf8") };
};

export const setStatus = async (
  projectRoot: string,
  config: EffectiveConfig,
  effort: string,
  file: string,
  status: string,
) => {
  if (!config.tracker.statuses.some((entry) => entry.name === status)) {
    throw new Error(`Unknown status: ${status}`);
  }
  const path = issuePathOf(projectRoot, config.tracker.folder, effort, file);
  const text = await readFile(path, "utf8");
  await writeFile(path, replaceStatus(text, status));
  return { status };
};

interface ProjectWatch {
  version: number;
  folder: string | null;
  trackerWatcher: FSWatcher | null;
  configWatcher: FSWatcher | null;
  waiters: Set<() => void>;
}

// Per project: a recursive watch on the tracker folder and a shallow one on the root for `paseo.json`.
// Any change bumps the version and wakes every pending long poll.
export const createChangeFeed = () => {
  const watches = new Map<string, ProjectWatch>();

  const bump = (entry: ProjectWatch) => {
    entry.version += 1;
    for (const wake of entry.waiters) {
      wake();
    }
    entry.waiters.clear();
  };

  const dropTrackerWatch = (entry: ProjectWatch) => {
    entry.trackerWatcher?.close();
    entry.trackerWatcher = null;
  };

  const ensureWatch = (rawRoot: string, folder: string) => {
    assertProjectRoot(rawRoot);
    const projectRoot = resolve(rawRoot);
    const known = watches.get(projectRoot);
    const entry: ProjectWatch = known ?? {
      version: 1,
      folder: null,
      trackerWatcher: null,
      configWatcher: null,
      waiters: new Set(),
    };
    watches.set(projectRoot, entry);

    if (!entry.configWatcher) {
      entry.configWatcher = watch(projectRoot, (_, filename) => {
        if (filename === "paseo.json") {
          bump(entry);
        }
      });
      entry.configWatcher.on("error", () => {
        entry.configWatcher?.close();
        entry.configWatcher = null;
      });
    }

    if (entry.folder !== folder) {
      dropTrackerWatch(entry);
      entry.folder = folder;
    }
    const tracker = trackerDir(projectRoot, folder);
    if (!entry.trackerWatcher && existsSync(tracker)) {
      entry.trackerWatcher = watch(tracker, { recursive: true }, () => bump(entry));
      entry.trackerWatcher.on("error", () => {
        dropTrackerWatch(entry);
        bump(entry);
      });
      // A client has already seen this project unwatched (no tracker yet, a dropped watch, a moved folder).
      if (known) {
        bump(entry);
      }
    }
    return entry;
  };

  const waitForChange = (projectRoot: string, folder: string, version: number, timeoutMs = quietPollMs) => {
    const entry = ensureWatch(projectRoot, folder);
    if (entry.version !== version) {
      return Promise.resolve({ version: entry.version });
    }
    return new Promise<{ version: number }>((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        resolve({ version: entry.version });
      };
      const timer = setTimeout(() => {
        entry.waiters.delete(wake);
        resolve({ version: entry.version });
      }, timeoutMs);
      entry.waiters.add(wake);
    });
  };

  // Personal settings apply to every project, so a change there refreshes every open board.
  const bumpAll = () => {
    for (const entry of watches.values()) {
      bump(entry);
    }
  };

  const close = () => {
    for (const entry of watches.values()) {
      dropTrackerWatch(entry);
      entry.configWatcher?.close();
      for (const wake of entry.waiters) {
        wake();
      }
    }
    watches.clear();
  };

  return { waitForChange, bumpAll, close };
};
