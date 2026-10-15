import { type FSWatcher, existsSync, watch } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { type Status, buildBoard, parseIssue, replaceStatus } from "../shared/issues";

const quietPollMs = 20_000;

// Effort and file names come from the client; anything that could leave `.scratch/<effort>/issues/` is refused.
const assertName = (value: string, kind: string) => {
  if (value === "" || value.startsWith(".") || /[/\\]/.test(value)) {
    throw new Error(`Invalid ${kind}: ${value}`);
  }
};

const assertProjectRoot = (projectRoot: string) => {
  if (!isAbsolute(projectRoot)) {
    throw new Error(`Project root must be absolute: ${projectRoot}`);
  }
};

const scratchDir = (projectRoot: string) => join(projectRoot, ".scratch");

export const issuesDirOf = (projectRoot: string, effort: string) => {
  assertProjectRoot(projectRoot);
  assertName(effort, "effort");
  return join(scratchDir(projectRoot), effort, "issues");
};

export const issuePathOf = (projectRoot: string, effort: string, file: string) => {
  assertName(file, "issue file");
  if (!file.endsWith(".md")) {
    throw new Error(`Not an issue file: ${file}`);
  }
  return join(issuesDirOf(projectRoot, effort), file);
};

// Efforts with an `issues/` folder, the most recently changed first.
export const listEfforts = async (projectRoot: string) => {
  assertProjectRoot(projectRoot);
  const scratch = scratchDir(projectRoot);
  if (!existsSync(scratch)) {
    return [];
  }
  const entries = await readdir(scratch, { withFileTypes: true });
  const efforts = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && existsSync(join(scratch, entry.name, "issues")))
      .map(async (entry) => ({
        name: entry.name,
        changedAt: (await stat(join(scratch, entry.name, "issues"))).mtimeMs,
      })),
  );
  return efforts.sort((a, b) => b.changedAt - a.changedAt).map((effort) => effort.name);
};

export const readBoard = async (projectRoot: string, effort: string) => {
  const issuesDir = issuesDirOf(projectRoot, effort);
  const files = existsSync(issuesDir)
    ? (await readdir(issuesDir)).filter((file) => file.endsWith(".md")).sort()
    : [];
  const issues = await Promise.all(
    files.map(async (file) => parseIssue(file, await readFile(join(issuesDir, file), "utf8"))),
  );
  const mapPath = join(scratchDir(projectRoot), effort, "map.md");
  return {
    board: buildBoard(issues),
    issuesDir,
    mapPath: existsSync(mapPath) ? mapPath : null,
  };
};

export const readIssue = async (projectRoot: string, effort: string, file: string) => {
  const path = issuePathOf(projectRoot, effort, file);
  return { path, text: await readFile(path, "utf8") };
};

export const setStatus = async (projectRoot: string, effort: string, file: string, status: Status) => {
  const path = issuePathOf(projectRoot, effort, file);
  const text = await readFile(path, "utf8");
  await writeFile(path, replaceStatus(text, status));
  return { status };
};

interface ScratchWatch {
  version: number;
  watcher: FSWatcher | null;
  waiters: Set<() => void>;
}

// One recursive watch per project; a change bumps its version and wakes every pending long poll.
export const createChangeFeed = () => {
  const watches = new Map<string, ScratchWatch>();

  const ensureWatch = (projectRoot: string) => {
    assertProjectRoot(projectRoot);
    let entry = watches.get(projectRoot);
    if (!entry) {
      entry = { version: 1, watcher: null, waiters: new Set() };
      watches.set(projectRoot, entry);
    }
    const scratch = scratchDir(projectRoot);
    if (!entry.watcher && existsSync(scratch)) {
      const current = entry;
      current.watcher = watch(scratch, { recursive: true }, () => {
        current.version += 1;
        for (const wake of current.waiters) {
          wake();
        }
        current.waiters.clear();
      });
      current.watcher.on("error", () => {
        current.watcher?.close();
        current.watcher = null;
      });
    }
    return entry;
  };

  const waitForChange = (projectRoot: string, version: number, timeoutMs = quietPollMs) => {
    const entry = ensureWatch(projectRoot);
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

  const close = () => {
    for (const entry of watches.values()) {
      entry.watcher?.close();
      for (const wake of entry.waiters) {
        wake();
      }
    }
    watches.clear();
  };

  return { waitForChange, close };
};
