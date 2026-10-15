import { type PluginSurfaceProps, useSettings } from "@getpaseo/plugin/client";
import { SettingsCard, SettingsRow, SettingsSection, SettingsSelect } from "@getpaseo/plugin/client/ui";
import { Text } from "react-native";
import { resolveAgentChoice } from "../shared/agent-choice";
import { agentDefaults } from "../shared/settings";
import { useProviderCatalog } from "./use-agent-choice";

const providerDefault = "";

export const SettingsScreen = ({ theme }: PluginSurfaceProps) => {
  const settings = useSettings(agentDefaults);
  const catalog = useProviderCatalog();

  if (settings.status !== "ready" || !catalog.data) {
    return <Text style={{ color: theme.colors.foregroundMuted }}>Loading…</Text>;
  }

  const values = settings.values;
  const resolved = resolveAgentChoice(catalog.data, values);
  const provider = catalog.data.find((entry) => entry.provider === resolved?.provider);
  const save = (patch: Partial<typeof values>) => void settings.save({ ...values, ...patch }, settings.revision);

  return (
    <SettingsSection title="Agent for Pick and Help me">
      <SettingsCard>
        <SettingsSelect
          label="Provider"
          value={resolved?.provider ?? values.provider}
          options={catalog.data.map((entry) => ({ label: entry.label, value: entry.provider }))}
          onValueChange={(next) => save({ provider: next, model: providerDefault, modeId: providerDefault })}
        />
        <SettingsSelect
          label="Model"
          hint="Provider default follows the provider's own pick."
          value={values.model}
          options={[
            { label: "Provider default", value: providerDefault },
            ...(provider?.models ?? []).map((model) => ({ label: model.label, value: model.id })),
          ]}
          onValueChange={(model) => save({ model })}
        />
        {(provider?.modes.length ?? 0) > 0 ? (
          <SettingsSelect
            label="Mode"
            value={values.modeId}
            options={[
              { label: "Provider default", value: providerDefault },
              ...(provider?.modes ?? []).map((mode) => ({ label: mode.label, value: mode.id })),
            ]}
            onValueChange={(modeId) => save({ modeId })}
          />
        ) : null}
        {settings.saveError ? <SettingsRow label="Not saved" error={String(settings.saveError)} /> : null}
      </SettingsCard>
    </SettingsSection>
  );
};
