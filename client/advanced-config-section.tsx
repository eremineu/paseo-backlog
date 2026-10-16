import type { PluginTheme } from "@getpaseo/plugin";
import { useRpc, useSettings } from "@getpaseo/plugin/client";
import { TextInput, copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { SettingsCard, SettingsRow, SettingsSection } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { builtInConfig } from "../shared/config";
import { checkPersonalConfig } from "../shared/rpc";
import { personalConfig } from "../shared/settings";
import { useStyles } from "./styles";

const starter = JSON.stringify(
  {
    version: 1,
    actions: [{ ...builtInConfig.actions[0], prompt: "/my-skill {issue}" }],
  },
  null,
  2,
);

// The personal layer as raw JSON, the same shape as `paseo.json` → `backlog`: for fixing a broken
// layer, or copying a config to a colleague. Collapsed, since the forms above cover everyday edits.
export const AdvancedConfigSection = ({ theme, compact }: { theme: PluginTheme; compact: boolean }) => {
  const styles = useStyles(theme, compact);
  const settings = useSettings(personalConfig);
  const check = useRpc(checkPersonalConfig);
  const toast = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof check>> | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [open, setOpen] = useState(false);

  if (settings.status === "loading") {
    return <Text style={styles.muted}>Loading…</Text>;
  }
  if (settings.status === "error") {
    return <Text style={styles.danger}>Could not read your backlog config: {settings.error}</Text>;
  }
  const saved = settings.status === "ready" ? settings.values.json : "";
  const text = draft ?? saved;

  const save = async () => {
    const checked = await check({ json: text });
    setResult(checked);
    if (checked.problems.some((problem) => problem.skipped)) {
      toast.error("Not saved: fix the problems listed under the editor.");
      return;
    }
    const ok = await settings.save({ json: text }, settings.revision);
    if (ok) {
      setDraft(null);
      toast.show("Saved. Open boards refresh on their own.", { variant: "success" });
    }
  };

  const copyDefaults = async () => {
    await copyText(JSON.stringify({ version: 1, ...builtInConfig }, null, 2));
    toast.show("Built-in config copied", { variant: "success" });
  };

  const toggle = (
    <Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)} style={styles.button}>
      <Text style={styles.buttonText}>{open ? "Hide JSON" : "Edit as JSON"}</Text>
    </Pressable>
  );

  if (!open) {
    return (
      <SettingsSection title="Advanced" trailing={toggle}>
        <SettingsCard>
          <SettingsRow
            label="Your config as JSON"
            hint="Edit it directly, fix a layer the forms can't read, or copy it to share with a colleague."
          />
        </SettingsCard>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title="Advanced" trailing={toggle}>
      <SettingsCard>
        <SettingsRow
          label="Your config as JSON"
          hint="Same shape as the backlog key in a repo's paseo.json, without the outer key. Actions merge by id; { id, hidden: true } hides one."
        >
          <View style={{ gap: 8, alignSelf: "stretch" }}>
            <TextInput
              accessibilityLabel="Personal backlog config JSON"
              multiline
              value={text}
              placeholder={starter}
              onChangeText={(next) => {
                setDraft(next);
                setResult(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.mono, { minHeight: 220, textAlignVertical: "top" }]}
            />
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={() => void save()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Check and save</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void check({ json: text }).then(setResult)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Check only</Text>
              </Pressable>
              {draft !== null ? (
                <Pressable accessibilityRole="button" onPress={() => setDraft(null)} style={styles.button}>
                  <Text style={styles.buttonText}>Discard changes</Text>
                </Pressable>
              ) : null}
            </View>
            {result && result.problems.length > 0
              ? result.problems.map((problem) => (
                  <Text key={problem.message} selectable style={styles.danger}>
                    {problem.message}
                  </Text>
                ))
              : null}
            {result && result.problems.length === 0 ? (
              <Text style={styles.muted}>
                Valid. Actions in order: {result.config.actions.map((action) => action.label).join(", ")}.
              </Text>
            ) : null}
            {settings.saveError ? <Text style={styles.danger}>{String(settings.saveError)}</Text> : null}
          </View>
        </SettingsRow>
        <SettingsRow label="Built-in config" hint="What applies when neither the repo nor you change anything.">
          <View style={[styles.row, { alignSelf: "stretch" }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDefaults((current) => !current)}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{showDefaults ? "Hide" : "Show"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void copyDefaults()} style={styles.button}>
              <Text style={styles.buttonText}>Copy</Text>
            </Pressable>
          </View>
          {showDefaults ? (
            <Text selectable style={styles.mono}>
              {JSON.stringify({ version: 1, ...builtInConfig }, null, 2)}
            </Text>
          ) : null}
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
};
