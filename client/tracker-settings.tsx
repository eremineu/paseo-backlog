import { TextInput } from "@getpaseo/plugin/client/react-native";
import { SettingsCard, SettingsRow, SettingsSection } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type ConfigLayer, type TrackerConfig, assignableSections, trackerSchema } from "../shared/config";
import { withTracker } from "../shared/layers";
import { Chips } from "./chips";
import type { Styles } from "./styles";

const sectionLabels: Record<(typeof assignableSections)[number], string> = {
  inFlight: "In flight",
  ready: "Ready to pick",
  yours: "Yours",
  later: "Later",
  done: "Done",
};

// Edits the personal tracker override. Fields left as they are stay out of the layer, so the team's
// or built-in value keeps applying to them.
export const TrackerSettings = ({
  effective,
  layer,
  styles,
  disabled,
  onSave,
}: {
  effective: TrackerConfig;
  layer: ConfigLayer | null;
  styles: Styles;
  disabled: boolean;
  onSave: (next: ConfigLayer) => void;
}) => {
  const [draft, setDraft] = useState(effective);
  const [error, setError] = useState<string | null>(null);
  const own = layer?.tracker ?? {};
  const isDirty = JSON.stringify(draft) !== JSON.stringify(effective);

  const updateStatus = (index: number, patch: Partial<TrackerConfig["statuses"][number]>) =>
    setDraft({
      ...draft,
      statuses: draft.statuses.map((status, position) => (position === index ? { ...status, ...patch } : status)),
    });

  const save = () => {
    const parsed = trackerSchema.safeParse(draft);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(`${issue.path.join(".")}: ${issue.message}`);
      return;
    }
    setError(null);
    // A field goes into the layer when it differs from what applies now, or when it is already yours.
    const keep = <Key extends keyof TrackerConfig>(key: Key): TrackerConfig[Key] | undefined =>
      JSON.stringify(parsed.data[key]) !== JSON.stringify(effective[key]) || own[key] !== undefined
        ? parsed.data[key]
        : undefined;
    onSave(
      withTracker(layer, {
        folder: keep("folder"),
        planningLabelPrefix: keep("planningLabelPrefix"),
        statuses: keep("statuses"),
      }),
    );
  };

  const field = (label: string, hint: string, value: string, onChange: (value: string) => void) => (
    <SettingsRow label={label} hint={hint}>
      <TextInput
        accessibilityLabel={label}
        editable={!disabled}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, styles.mono, { minWidth: 200 }]}
      />
    </SettingsRow>
  );

  return (
    <SettingsSection title="Tracker">
      <SettingsCard>
        {field("Folder", "Under the project root; holds <effort>/issues/*.md.", draft.folder, (folder) =>
          setDraft({ ...draft, folder }),
        )}
        {field(
          "Planning label",
          "Issues with a label starting with this are planning work. Empty turns it off.",
          draft.planningLabelPrefix,
          (planningLabelPrefix) => setDraft({ ...draft, planningLabelPrefix }),
        )}
        {draft.statuses.map((status, index) => (
          <SettingsRow key={index} label={`Status ${index + 1}`}>
            <View style={styles.row}>
              <TextInput
                accessibilityLabel={`Status ${index + 1} name`}
                editable={!disabled}
                value={status.name}
                onChangeText={(name) => updateStatus(index, { name })}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.mono, { minWidth: 140 }]}
              />
              <Chips
                options={assignableSections.map((section) => ({ label: sectionLabels[section], value: section }))}
                value={status.section}
                styles={styles}
                onChange={(section) => updateStatus(index, { section })}
              />
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() =>
                  setDraft({ ...draft, statuses: draft.statuses.filter((_, position) => position !== index) })
                }
                style={styles.button}
              >
                <Text style={styles.buttonText}>Remove</Text>
              </Pressable>
            </View>
          </SettingsRow>
        ))}
        <SettingsRow label="" hint="A changed status list replaces the whole list for you.">
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => setDraft({ ...draft, statuses: [...draft.statuses, { name: "", section: "later" }] })}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Add status</Text>
            </Pressable>
            {isDirty ? (
              <Pressable accessibilityRole="button" onPress={() => setDraft(effective)} style={styles.button}>
                <Text style={styles.buttonText}>Discard</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={disabled || !isDirty}
              onPress={save}
              style={[styles.primaryButton, { opacity: disabled || !isDirty ? 0.5 : 1 }]}
            >
              <Text style={styles.primaryButtonText}>Save tracker</Text>
            </Pressable>
            {Object.keys(own).length > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => onSave(withTracker(layer, {}))}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Reset to default</Text>
              </Pressable>
            ) : null}
          </View>
          {error ? <Text style={styles.danger}>{error}</Text> : null}
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
};
