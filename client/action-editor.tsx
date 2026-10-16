import { Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { SettingsCard, SettingsRow, SettingsSection, SettingsSelect, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type CatalogProvider, resolveAgentChoice } from "../shared/agent-choice";
import { type ActionConfig, actionSchema } from "../shared/config";
import { branchTypes } from "../shared/issues";
import { Chips } from "./chips";
import type { Styles } from "./styles";

const promptPlaceholders = ["issue", "map", "project", "branch", "id", "title", "effort"] as const;
const branchPlaceholders = ["type", "effortPrefix", "effort", "slug", "id"] as const;
const noStatus = "";
const providerDefault = "";

const errorOf = (action: unknown) => {
  const parsed = actionSchema.safeParse(action);
  if (parsed.success) {
    return null;
  }
  const issue = parsed.error.issues[0];
  return `${issue.path.join(".") || "action"}: ${issue.message}`;
};

const MultiChips = ({
  options,
  selected,
  styles,
  onToggle,
}: {
  options: readonly string[];
  selected: readonly string[];
  styles: Styles;
  onToggle: (value: string) => void;
}) => (
  <View style={styles.row}>
    {options.map((option) => {
      const active = selected.includes(option);
      return (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          onPress={() => onToggle(option)}
          style={active ? styles.chipActive : styles.chip}
        >
          <Text style={active ? styles.chipTextActive : styles.chipText}>{option}</Text>
        </Pressable>
      );
    })}
  </View>
);

export const ActionEditor = ({
  title,
  initial,
  statuses,
  catalog,
  styles,
  onSave,
  onClose,
}: {
  title: string;
  initial: ActionConfig;
  statuses: readonly string[];
  catalog: readonly CatalogProvider[];
  styles: Styles;
  onSave: (action: ActionConfig) => void;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<ActionConfig>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };
  const updateShowFor = (patch: Partial<ActionConfig["showFor"]>) =>
    update({ showFor: { ...draft.showFor, ...patch } });

  const anyOpenStatus = draft.showFor.statuses === undefined;
  const chosenStatuses = draft.showFor.statuses ?? [];
  const toggleStatus = (status: string) =>
    updateShowFor({
      statuses: chosenStatuses.includes(status)
        ? chosenStatuses.filter((existing) => existing !== status)
        : [...chosenStatuses, status],
    });

  const agentProvider = catalog.find((entry) => entry.provider === draft.agent?.provider);
  const setAgentProvider = (provider: string) => {
    const resolved = resolveAgentChoice(catalog, { provider, model: "", modeId: "" });
    update({ agent: resolved ? { provider: resolved.provider } : undefined });
  };

  const updateAgent = (patch: { model?: string; modeId?: string }) => {
    if (draft.agent) {
      update({ agent: { ...draft.agent, ...patch } });
    }
  };

  const save = () => {
    const problem = errorOf(draft);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(actionSchema.parse(draft));
  };

  return (
    <Modal
      title={title}
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Modal.Content>
        <SettingsSection title="Button">
          <SettingsCard>
            <SettingsRow label="Label" hint={`Id: ${draft.id}`}>
              <TextInput
                accessibilityLabel="Action label"
                value={draft.label}
                onChangeText={(label) => update({ label })}
                style={[styles.input, { minWidth: 200 }]}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Shows on">
          <SettingsCard>
            <SettingsSwitch
              label="Any open status"
              hint="Every status outside the Done section."
              value={anyOpenStatus}
              onValueChange={(any) => updateShowFor({ statuses: any ? undefined : [] })}
            />
            {anyOpenStatus ? null : (
              <SettingsRow label="Statuses">
                <MultiChips options={statuses} selected={chosenStatuses} styles={styles} onToggle={toggleStatus} />
              </SettingsRow>
            )}
            <SettingsSelect
              label="Planning issues"
              value={draft.showFor.planning}
              options={[
                { label: "Show on all issues", value: "any" as const },
                { label: "Only planning issues", value: "only" as const },
                { label: "Not on planning issues", value: "exclude" as const },
              ]}
              onValueChange={(planning) => updateShowFor({ planning })}
            />
            <SettingsSwitch
              label="Also on blocked issues"
              value={draft.showFor.blocked}
              onValueChange={(blocked) => updateShowFor({ blocked })}
            />
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Runs">
          <SettingsCard>
            <SettingsSelect
              label="Where"
              hint="Projects without git always run in the project folder."
              value={draft.runIn}
              options={[
                { label: "New git worktree", value: "worktree" as const },
                { label: "Project folder", value: "project" as const },
              ]}
              onValueChange={(runIn) => update({ runIn })}
            />
            {draft.runIn === "worktree" ? (
              <>
                <SettingsSelect
                  label="Branch type"
                  value={draft.branchType}
                  options={[...new Set([draft.branchType, ...branchTypes])].map((value) => ({ label: value, value }))}
                  onValueChange={(branchType) => update({ branchType })}
                />
                <SettingsRow
                  label="Branch"
                  hint={`Placeholders: ${branchPlaceholders.map((name) => `{${name}}`).join(" ")}`}
                >
                  <TextInput
                    accessibilityLabel="Branch template"
                    value={draft.branch}
                    onChangeText={(branch) => update({ branch })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, styles.mono, { minWidth: 240 }]}
                  />
                </SettingsRow>
              </>
            ) : null}
            <SettingsSelect
              label="Status on start"
              hint="Put back if the agent fails to start."
              value={draft.setStatus ?? noStatus}
              options={[
                { label: "Leave as is", value: noStatus },
                ...statuses.map((value) => ({ label: value, value })),
              ]}
              onValueChange={(status) => update({ setStatus: status === noStatus ? null : status })}
            />
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Agent">
          <SettingsCard>
            <SettingsSwitch
              label="Use a specific agent"
              hint="Off: your default agent from the top of this page."
              value={draft.agent !== undefined}
              onValueChange={(on) => {
                if (on) {
                  setAgentProvider(catalog[0]?.provider ?? "claude");
                } else {
                  update({ agent: undefined });
                }
              }}
            />
            {draft.agent ? (
              <>
                <SettingsSelect
                  label="Provider"
                  value={draft.agent.provider}
                  options={catalog.map((entry) => ({ label: entry.label, value: entry.provider }))}
                  onValueChange={setAgentProvider}
                />
                <SettingsSelect
                  label="Model"
                  value={draft.agent.model ?? providerDefault}
                  options={[
                    { label: "Provider default", value: providerDefault },
                    ...(agentProvider?.models ?? []).map((model) => ({ label: model.label, value: model.id })),
                  ]}
                  onValueChange={(model) => updateAgent({ model: model || undefined })}
                />
                {(agentProvider?.modes.length ?? 0) > 0 ? (
                  <SettingsSelect
                    label="Mode"
                    value={draft.agent.modeId ?? providerDefault}
                    options={[
                      { label: "Provider default", value: providerDefault },
                      ...(agentProvider?.modes ?? []).map((mode) => ({ label: mode.label, value: mode.id })),
                    ]}
                    onValueChange={(modeId) => updateAgent({ modeId: modeId || undefined })}
                  />
                ) : null}
              </>
            ) : null}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title="Prompt">
          <SettingsCard>
            <SettingsRow label="Sent to the agent" hint="Tap a placeholder to add it at the end.">
              <View style={{ gap: 8, alignSelf: "stretch" }}>
                <TextInput
                  accessibilityLabel="Prompt"
                  multiline
                  value={draft.prompt}
                  onChangeText={(prompt) => update({ prompt })}
                  style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
                />
                <Chips
                  options={promptPlaceholders.map((name) => ({ value: name, label: `{${name}}` }))}
                  value={null}
                  styles={styles}
                  onChange={(name) =>
                    update({ prompt: `${draft.prompt}${draft.prompt.endsWith(" ") ? "" : " "}{${name}}` })
                  }
                />
              </View>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        {error ? <Text style={styles.danger}>{error}</Text> : null}
        <View style={[styles.row, { justifyContent: "flex-end" }]}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={save} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Save action</Text>
          </Pressable>
        </View>
      </Modal.Content>
    </Modal>
  );
};
