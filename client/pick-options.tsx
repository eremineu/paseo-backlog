import { Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type AgentChoice, type CatalogProvider, resolveAgentChoice } from "../shared/agent-choice";
import { branchNameFor, branchTypes } from "../shared/issues";
import { Chips } from "./chips";
import type { Styles } from "./styles";

export interface PickOverrides {
  branchName: string;
  choice: AgentChoice;
}

export const PickOptions = ({
  file,
  defaultScope,
  defaultChoice,
  catalog,
  styles,
  onStart,
  onClose,
}: {
  file: string;
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
  const trimmedScope = scope.trim();
  const branchName = branchNameFor({ type, scope: trimmedScope, file });

  const pickProvider = (next: string) => {
    const resolved = resolveAgentChoice(catalog, { provider: next, model: "", modeId: "" });
    if (resolved) {
      setChoice(resolved);
    }
  };

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
        <View style={{ gap: 6 }}>
          <Text style={styles.sectionTitle}>Branch</Text>
          <Chips
            options={branchTypes.map((value) => ({ value, label: value }))}
            value={type}
            styles={styles}
            onChange={setType}
          />
          <TextInput
            accessibilityLabel="Scope"
            value={scope}
            onChangeText={setScope}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Text selectable style={styles.mono}>
            {branchName}
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.sectionTitle}>Agent</Text>
          <Chips
            options={catalog.map((entry) => ({ value: entry.provider, label: entry.label }))}
            value={choice.provider}
            styles={styles}
            onChange={pickProvider}
          />
          <Chips
            options={(provider?.models ?? []).map((model) => ({ value: model.id, label: model.label }))}
            value={choice.model}
            styles={styles}
            onChange={(model) => setChoice({ ...choice, model })}
          />
          {(provider?.modes.length ?? 0) > 0 ? (
            <Chips
              options={(provider?.modes ?? []).map((mode) => ({ value: mode.id, label: mode.label }))}
              value={choice.modeId}
              styles={styles}
              onChange={(modeId) => setChoice({ ...choice, modeId })}
            />
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={trimmedScope === ""}
          onPress={() => onStart({ branchName, choice })}
          style={[styles.primaryButton, { alignSelf: "flex-start", opacity: trimmedScope === "" ? 0.5 : 1 }]}
        >
          <Text style={styles.primaryButtonText}>Start in a new worktree</Text>
        </Pressable>
      </Modal.Content>
    </Modal>
  );
};
