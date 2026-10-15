export interface CatalogProvider {
  readonly provider: string;
  readonly label: string;
  readonly models: readonly { readonly id: string; readonly label: string; readonly isDefault: boolean }[];
  readonly modes: readonly { readonly id: string; readonly label: string }[];
  readonly defaultModeId: string | null;
}

export interface AgentChoice {
  readonly provider: string;
  readonly model: string;
  readonly modeId: string | null;
}

// Fills an empty or stale model or mode with the provider's own default, so a saved choice
// keeps working after a provider drops a model.
export const resolveAgentChoice = (
  catalog: readonly CatalogProvider[],
  wanted: { provider: string; model: string; modeId: string },
): AgentChoice | null => {
  const entry = catalog.find((candidate) => candidate.provider === wanted.provider) ?? catalog[0];
  if (!entry) {
    return null;
  }
  const model =
    entry.models.find((candidate) => candidate.id === wanted.model) ??
    entry.models.find((candidate) => candidate.isDefault) ??
    entry.models[0];
  if (!model) {
    return null;
  }
  const mode = entry.modes.find((candidate) => candidate.id === wanted.modeId);
  return { provider: entry.provider, model: model.id, modeId: mode?.id ?? entry.defaultModeId };
};

export const providerString = (choice: AgentChoice) => `${choice.provider}/${choice.model}`;
