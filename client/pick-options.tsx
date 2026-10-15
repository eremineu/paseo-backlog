import { Modal } from "@getpaseo/plugin/client/react-native";
import { SettingsCard, SettingsInput, SettingsRow, SettingsSection, SettingsSelect } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type AgentChoice, type CatalogProvider, resolveAgentChoice } from "../shared/agent-choice";
import { branchNameFor, branchTypes } from "../shared/issues";
import type { Styles } from "./styles";

export interface PickOverrides {
  branchName: string;
  choice: AgentChoice;
}

const providerDefaultMode = "";

export const PickOptions = ({
  file,
  isGit,
  defaultScope,
  defaultChoice,
  catalog,
  styles,
  onStart,
  onClose,
}: {
  file: string;
  isGit: boolean;
  defaultScope: string;
  defaultChoice: AgentChoice;
  catalog: readonly CatalogProvider[];
  styles: Styles;
  onStart: (overrides: PickOverrides) => void;
  onClose: () => void;
}) => {
  const [type, setType] = useState<string>("feat");
  const [scope, setScope] = useState(defaultScope);
  const [choice, setChoice] = useState(defaultChoice);
  const provider = catalog.find((entry) => entry.provider === choice.provider);
  const hasScope = !isGit || /[a-z0-9]/i.test(scope);
  const branchName = branchNameFor({ type, scope, file });

  const pickProvider = (next: string) => {
    const resolved = resolveAgentChoice(catalog, { provider: next, model: "", modeId: "" });
    if (resolved) {
      setChoice(resolved);
    }
  };

  const modelOptions = (provider?.models ?? []).map((model) => ({
    label: model.isDefault ? `${model.label} (default)` : model.label,
    value: model.id,
  }));
  const modeOptions = [
    { label: "Provider default", value: providerDefaultMode },
    ...(provider?.modes ?? []).map((mode) => ({ label: mode.label, value: mode.id })),
  ];

  return (
    <Modal
      title="Pick with options"
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Modal.Content>
        {isGit ? (
          <SettingsSection title="Worktree">
            <SettingsCard>
              <SettingsSelect
                label="Type"
                value={type}
                options={branchTypes.map((value) => ({ label: value, value }))}
                onValueChange={setType}
              />
              <SettingsInput
                label="Scope"
                hint="The app the change lands in."
                initialValue={defaultScope}
                onChangeText={setScope}
                error={hasScope ? null : "Scope needs at least one letter or digit."}
              />
              <SettingsRow label="Branch">
                <Text selectable style={styles.mono}>
                  {branchName}
                </Text>
              </SettingsRow>
            </SettingsCard>
          </SettingsSection>
        ) : null}

        <SettingsSection title="Agent">
          <SettingsCard>
            <SettingsSelect
              label="Provider"
              value={choice.provider}
              options={catalog.map((entry) => ({ label: entry.label, value: entry.provider }))}
              onValueChange={pickProvider}
            />
            <SettingsSelect
              label="Model"
              value={choice.model}
              options={modelOptions}
              onValueChange={(model) => setChoice({ ...choice, model })}
            />
            {(provider?.modes.length ?? 0) > 0 ? (
              <SettingsSelect
                label="Mode"
                value={choice.modeId ?? providerDefaultMode}
                options={modeOptions}
                onValueChange={(modeId) => setChoice({ ...choice, modeId: modeId === providerDefaultMode ? null : modeId })}
              />
            ) : null}
          </SettingsCard>
        </SettingsSection>

        <View style={[styles.row, { justifyContent: "flex-end" }]}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!hasScope}
            onPress={() => onStart({ branchName, choice })}
            style={[styles.primaryButton, { opacity: hasScope ? 1 : 0.5 }]}
          >
            <Text style={styles.primaryButtonText}>{isGit ? "Start in a new worktree" : "Start in the project folder"}</Text>
          </Pressable>
        </View>
      </Modal.Content>
    </Modal>
  );
};
