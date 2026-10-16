import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { configProblemSchema, effectiveConfigSchema } from "./config";
import { boardSchema } from "./issues";

const effortInput = z.object({ projectRoot: z.string(), effort: z.string() });
const issueInput = effortInput.extend({ file: z.string() });

export const listEfforts = defineRpc({
  name: "backlog.efforts",
  input: z.object({ projectRoot: z.string() }),
  output: z.object({ efforts: z.array(z.string()), folder: z.string(), problems: z.array(configProblemSchema) }),
});

export const readBoard = defineRpc({
  name: "backlog.board",
  input: effortInput,
  output: z.object({
    board: boardSchema,
    issuesDir: z.string(),
    mapPath: z.string().nullable(),
    config: effectiveConfigSchema,
    problems: z.array(configProblemSchema),
  }),
});

// Long poll: resolves as soon as the tracker, `paseo.json` or the personal config changes, or after a quiet stretch
// shorter than Paseo's 30 s RPC timeout. The client calls it again with the version it got.
export const waitForChange = defineRpc({
  name: "backlog.wait",
  input: z.object({ projectRoot: z.string(), version: z.number() }),
  output: z.object({ version: z.number() }),
});

export const setStatus = defineRpc({
  name: "backlog.set-status",
  // `restore` writes back the status a failed start replaced, which may be one the config doesn't list.
  input: issueInput.extend({ status: z.string(), restore: z.boolean().optional() }),
  output: z.object({ status: z.string() }),
});

export const readIssue = defineRpc({
  name: "backlog.issue",
  input: issueInput,
  output: z.object({ path: z.string(), text: z.string() }),
});

export const agentLinkSchema = z.object({ agentId: z.string(), workspaceId: z.string() });
export type AgentLink = z.infer<typeof agentLinkSchema>;

export const listLinks = defineRpc({
  name: "backlog.links",
  input: effortInput,
  output: z.object({ links: z.record(z.string(), agentLinkSchema) }),
});

export const saveLink = defineRpc({
  name: "backlog.link",
  input: issueInput.extend({ link: agentLinkSchema }),
  output: z.object({}),
});

// Checks a personal config draft against the built-in defaults, for the settings editor.
export const checkPersonalConfig = defineRpc({
  name: "backlog.check-config",
  input: z.object({ json: z.string() }),
  output: z.object({ config: effectiveConfigSchema, problems: z.array(configProblemSchema) }),
});

// What the settings screen previews for one project: the repo's own layer as written, and the
// result of every layer together. With no project, only the built-in and personal layers count.
export const previewConfig = defineRpc({
  name: "backlog.preview-config",
  input: z.object({ projectRoot: z.string().nullable() }),
  output: z.object({
    repo: z.object({ source: z.string(), value: z.unknown(), problem: z.string().nullable() }).nullable(),
    config: effectiveConfigSchema,
    problems: z.array(configProblemSchema),
  }),
});
