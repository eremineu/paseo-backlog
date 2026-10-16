import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

// Empty model or mode means "whatever the provider marks as its default".
export const agentDefaults = defineSettings({
  id: "agent-defaults",
  scope: "host",
  version: 1,
  schema: z.object({
    provider: z.string().default("claude"),
    model: z.string().default(""),
    modeId: z.string().default(""),
  }),
});

// The person's own config layer, kept as the JSON text they typed so a half-edited value is never lost.
export const personalConfig = defineSettings({
  id: "personal-config",
  scope: "host",
  version: 1,
  schema: z.object({ json: z.string().default("") }),
});
