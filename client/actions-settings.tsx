import { SettingsCard, SettingsRow, SettingsSection } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { CatalogProvider } from "../shared/agent-choice";
import { type ActionConfig, type ConfigLayer, builtInConfig } from "../shared/config";
import { type ActionRow, type Origin, uniqueActionId, withAction, withHidden, withoutEntry } from "../shared/layers";
import { ActionEditor } from "./action-editor";
import type { Styles } from "./styles";

const originLabel: Record<Origin, string> = {
  "built-in": "Built-in",
  repo: "Team, from paseo.json",
  personal: "Yours",
};

const summaryOf = (action: ActionConfig) => {
  const where = action.runIn === "worktree" ? `new worktree on ${action.branch}` : "project folder";
  const on = action.showFor.statuses ? action.showFor.statuses.join(", ") || "no statuses" : "any open status";
  const planning = { any: "", only: ", planning only", exclude: ", not planning" }[action.showFor.planning];
  const status = action.setStatus ? `, sets ${action.setStatus}` : "";
  return `On ${on}${planning} · ${where}${status}`;
};

const describeOrigin = (row: ActionRow) => {
  if (row.hiddenBy) {
    return `Hidden ${row.hiddenBy === "personal" ? "by you" : "by the team"}`;
  }
  return row.overridesLower ? "Yours, replacing the default" : originLabel[row.origin];
};

type Editing = { kind: "edit"; row: ActionRow } | { kind: "new" } | null;

export const ActionsSettings = ({
  rows,
  layer,
  statuses,
  catalog,
  styles,
  disabled,
  onSave,
}: {
  rows: readonly ActionRow[];
  layer: ConfigLayer | null;
  statuses: readonly string[];
  catalog: readonly CatalogProvider[];
  styles: Styles;
  disabled: boolean;
  onSave: (next: ConfigLayer) => void;
}) => {
  const [editing, setEditing] = useState<Editing>(null);

  const newAction = (): ActionConfig => ({
    ...builtInConfig.actions[0],
    id: uniqueActionId(
      "New action",
      rows.map((row) => row.id),
    ),
    label: "New action",
    setStatus: null,
    prompt: "Work on {issue}.",
  });

  const button = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[primary ? styles.primaryButton : styles.button, { opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={primary ? styles.primaryButtonText : styles.buttonText}>{label}</Text>
    </Pressable>
  );

  const rowButtons = (row: ActionRow) => {
    const isOwn = row.origin === "personal" && !row.overridesLower;
    const showAgain = () =>
      row.hiddenBy === "personal" ? onSave(withoutEntry(layer, row.id)) : onSave(withAction(layer, row.action));
    return (
      <View style={styles.row}>
        {row.hiddenBy ? null : button("Edit", () => setEditing({ kind: "edit", row }))}
        {row.hiddenBy ? button("Show", showAgain) : button("Hide", () => onSave(withHidden(layer, row.id)))}
        {row.overridesLower ? button("Reset", () => onSave(withoutEntry(layer, row.id))) : null}
        {isOwn && !row.hiddenBy ? button("Delete", () => onSave(withoutEntry(layer, row.id))) : null}
      </View>
    );
  };

  return (
    <SettingsSection title="Actions" trailing={button("Add action", () => setEditing({ kind: "new" }), true)}>
      <SettingsCard>
        {rows.map((row) => (
          <SettingsRow key={row.id} label={row.action.label} hint={`${describeOrigin(row)} · ${summaryOf(row.action)}`}>
            {rowButtons(row)}
          </SettingsRow>
        ))}
      </SettingsCard>
      {editing ? (
        <ActionEditor
          title={editing.kind === "new" ? "New action" : `Edit ${editing.row.action.label}`}
          initial={editing.kind === "new" ? newAction() : editing.row.action}
          statuses={statuses}
          catalog={catalog}
          styles={styles}
          onSave={(action) => {
            setEditing(null);
            onSave(withAction(layer, action));
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </SettingsSection>
  );
};
