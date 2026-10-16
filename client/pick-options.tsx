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
  actionLabel,
  actionId,
  actionChoices,
  onSwitchAction,
  file,
  inWorktree,
  branchTemplate,
  defaultType,
  defaultScope,
  effort,
  defaultChoice,
  catalog,
  styles,
  onStart,
  onClose,
}: {
  actionLabel: string;
  actionId: string;
  actionChoices: readonly { value: string; label: string }[];
  onSwitchAction: (id: string) => void;
  file: string;
  inWorktree: boolean;
  branchTemplate: string;
  defaultType: string;
  defaultScope: string;
  effort: string;
  defaultChoice: AgentChoice;
  catalog: readonly CatalogProvider[];
  styles: Styles;
  onStart: (overrides: PickOverrides) => void;
  onClose: () => void;
}) => {
  const [type, setType] = useState(defaultType);
  const [scope, setScope] = useState(defaultScope);
  const [choice, setChoice] = useState(defaultChoice);
  const provider = catalog.find((entry) => entry.provider === choice.provider);
  const hasScope = !inWorktree || /[a-z0-9]/i.test(scope);
  const branchName = branchNameFor({ template: branchTemplate, type, scope, effort, file });
  const typeOptions = [...new Set([defaultType, ...branchTypes])].map((value) => ({ label: value, value }));

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
      title={`${actionLabel} with options`}
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Modal.Content>
        {actionChoices.length > 1 ? (
          <SettingsSection title="Action">
            <SettingsCard>
              <SettingsSelect label="Run" value={actionId} options={actionChoices} onValueChange={onSwitchAction} />
            </SettingsCard>
          </SettingsSection>
        ) : null}
        {inWorktree ? (
          <SettingsSection title="Worktree">
            <SettingsCard>
              <SettingsSelect
                label="Type"
                value={type}
                options={typeOptions}
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
            <Text style={styles.primaryButtonText}>{inWorktree ? "Start in a new worktree" : "Start in the project folder"}</Text>
          </Pressable>
        </View>
      </Modal.Content>
    </Modal>
  );
};
