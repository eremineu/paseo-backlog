import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { type AgentLink, agentLinkSchema } from "../shared/rpc";

const linksFileSchema = z.record(z.string(), agentLinkSchema);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const defaultLinksPath = () =>
  join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "paseo-backlog", "links.json");

// Card-to-agent links, keyed by the issue's absolute path, kept out of the tracker's markdown.
export const createLinkStore = (path = defaultLinksPath()) => {
  let writes = Promise.resolve();

  const readAll = async () => {
    if (!existsSync(path)) {
      return {};
    }
    // A truncated or hand-broken file reads as empty, so the next save replaces it instead of failing forever.
    const parsed = linksFileSchema.safeParse(parseJson(await readFile(path, "utf8")));
    return parsed.success ? parsed.data : {};
  };

  const linksUnder = async (issuesDir: string) => {
    const prefix = `${issuesDir}/`;
    const links = await readAll();
    return Object.fromEntries(
      Object.entries(links)
        .filter(([issuePath]) => issuePath.startsWith(prefix))
        .map(([issuePath, link]) => [issuePath.slice(prefix.length), link]),
    );
  };

  // Writes are queued so two picks in quick succession don't drop one another's link.
  const save = (issuePath: string, link: AgentLink) => {
    writes = writes.catch(() => undefined).then(async () => {
      const links = { ...(await readAll()), [issuePath]: link };
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.tmp`;
      await writeFile(temporary, JSON.stringify(links, null, 2));
      await rename(temporary, path);
    });
    return writes;
  };

  return { linksUnder, save };
};
