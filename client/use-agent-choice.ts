import { usePaseo, useSettings } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { type CatalogProvider, resolveAgentChoice } from "../shared/agent-choice";
import { agentDefaults } from "../shared/settings";

export const useProviderCatalog = () => {
  const paseo = usePaseo();
  return useQuery({
    queryKey: ["backlog", "providers"],
    queryFn: async (): Promise<CatalogProvider[]> => {
      const snapshot = await paseo.providers.snapshot();
      return snapshot.entries
        .filter((entry) => entry.enabled && entry.status === "ready" && (entry.models?.length ?? 0) > 0)
        .map((entry) => ({
          provider: entry.provider,
          label: entry.label ?? entry.provider,
          models: (entry.models ?? []).map((model) => ({
            id: model.id,
            label: model.label,
            isDefault: model.isDefault ?? false,
          })),
          modes: (entry.modes ?? []).map((mode) => ({ id: mode.id, label: mode.label })),
          defaultModeId: entry.defaultModeId ?? null,
        }));
    },
    staleTime: 60_000,
  });
};

// The saved default agent, filled in with provider defaults; null until both are loaded.
export const useDefaultAgentChoice = () => {
  const catalog = useProviderCatalog();
  const settings = useSettings(agentDefaults);
  if (!catalog.data || settings.status !== "ready") {
    return { catalog: catalog.data ?? [], choice: null };
  }
  return { catalog: catalog.data, choice: resolveAgentChoice(catalog.data, settings.values) };
};
