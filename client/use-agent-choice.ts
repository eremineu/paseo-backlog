import { usePaseo, useSettings } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { type CatalogProvider, resolveAgentChoice } from "../shared/agent-choice";
import { agentDefaults } from "../shared/settings";

const builtInDefaults = agentDefaults.schema.parse({});

// The app's connection keeps provider snapshots in a compact wire form whose entries carry no models,
// so models and modes come from the per-provider calls; the snapshot only adds labels and default modes.
export const useProviderCatalog = () => {
  const paseo = usePaseo();
  return useQuery({
    queryKey: ["backlog", "providers"],
    queryFn: async (): Promise<CatalogProvider[]> => {
      const [availability, snapshot] = await Promise.all([
        paseo.providers.listAvailable(),
        paseo.providers.snapshot().catch(() => null),
      ]);
      const available = availability.providers.filter((entry) => entry.available);
      const providers = await Promise.all(
        available.map(async ({ provider }) => {
          const [models, modes] = await Promise.all([
            paseo.providers.listModels(provider).catch(() => null),
            paseo.providers.listModes(provider).catch(() => null),
          ]);
          const entry = snapshot?.entries.find((candidate) => candidate.provider === provider);
          return {
            provider,
            label: entry?.label ?? provider.charAt(0).toUpperCase() + provider.slice(1),
            models: (models?.models ?? []).map((model) => ({
              id: model.id,
              label: model.label,
              isDefault: model.isDefault ?? false,
            })),
            modes: (modes?.modes ?? []).map((mode) => ({ id: mode.id, label: mode.label })),
            defaultModeId: entry?.defaultModeId ?? null,
          };
        }),
      );
      return providers.filter((provider) => provider.models.length > 0);
    },
    staleTime: 60_000,
  });
};

// The saved default agent, filled in with provider defaults. Unreadable settings fall back to the built-in defaults.
export const useDefaultAgentChoice = () => {
  const catalog = useProviderCatalog();
  const settings = useSettings(agentDefaults);
  const catalogEntries = catalog.data ?? [];
  const wanted = settings.status === "ready" ? settings.values : builtInDefaults;
  const isLoading = catalog.isLoading || settings.status === "loading";
  return {
    catalog: catalogEntries,
    choice: isLoading ? null : resolveAgentChoice(catalogEntries, wanted),
    isLoading,
    error: catalog.error,
  };
};
