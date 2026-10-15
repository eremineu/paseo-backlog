import { usePaseo } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";

export interface AgentState {
  status: string;
  attentionReason: string | null;
  archived: boolean;
}

const refreshMs = 3_000;

// `useAgent` only works inside a workspace panel, and the board also renders on a sidebar screen,
// so linked agents are read through the SDK and refreshed on a short interval.
export const useAgentStates = (agentIds: readonly string[]) => {
  const paseo = usePaseo();
  const ids = [...new Set(agentIds)].sort();
  const states = useQuery({
    queryKey: ["backlog", "agents", ids],
    queryFn: async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          const result = await paseo.agents
            .ref(id)
            .refresh()
            .catch(() => null);
          if (!result) {
            return [id, null] as const;
          }
          const { status, attentionReason, archivedAt } = result.agent;
          return [id, { status, attentionReason: attentionReason ?? null, archived: Boolean(archivedAt) }] as const;
        }),
      );
      return new Map<string, AgentState | null>(entries);
    },
    enabled: ids.length > 0,
    refetchInterval: refreshMs,
  });
  return states.data ?? new Map<string, AgentState | null>();
};
