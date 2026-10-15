import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { boardSchema, statusSchema } from "./issues";

const effortInput = z.object({ projectRoot: z.string(), effort: z.string() });
const issueInput = effortInput.extend({ file: z.string() });

export const listEfforts = defineRpc({
  name: "backlog.efforts",
  input: z.object({ projectRoot: z.string() }),
  output: z.object({ efforts: z.array(z.string()) }),
});

export const readBoard = defineRpc({
  name: "backlog.board",
  input: effortInput,
  output: z.object({
    board: boardSchema,
    issuesDir: z.string(),
    mapPath: z.string().nullable(),
  }),
});

// Long poll: resolves as soon as anything under `.scratch/` changes, or after a quiet stretch
// shorter than Paseo's 30 s RPC timeout. The client calls it again with the version it got.
export const waitForChange = defineRpc({
  name: "backlog.wait",
  input: z.object({ projectRoot: z.string(), version: z.number() }),
  output: z.object({ version: z.number() }),
});

export const setStatus = defineRpc({
  name: "backlog.set-status",
  input: issueInput.extend({ status: statusSchema }),
  output: z.object({ status: statusSchema }),
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
