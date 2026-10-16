import type { PluginTheme } from "@getpaseo/plugin";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import { SettingsCard, SettingsRow, SettingsSection } from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import type { ConfigLayer } from "../shared/config";
import { describeActions, parseLayer } from "../shared/layers";
import { previewConfig } from "../shared/rpc";
import { ActionsSettings } from "./actions-settings";
import { AdvancedConfigSection } from "./advanced-config-section";
import { Chips } from "./chips";
import { useStyles } from "./styles";
import { TrackerSettings } from "./tracker-settings";
import { useProviderCatalog } from "./use-agent-choice";
import { usePersonalLayer } from "./use-personal-layer";

const noProject = "";

const teamConfigHint = (repo: { source: string; value: unknown; problem: string | null }) => {
  if (repo.problem) {
    return `${repo.source}: ${repo.problem}`;
  }
  return repo.value ? `${repo.source} is in use.` : "This repo's paseo.json has no backlog key.";
};

// Forms for the personal layer, shown against the result for one project so a team's paseo.json is visible.
export const ConfigSettings = ({ theme, compact }: { theme: PluginTheme; compact: boolean }) => {
  const styles = useStyles(theme, compact);
  const paseo = usePaseo();
  const toast = useToast();
  const fetchPreview = useRpc(previewConfig);
  const personal = usePersonalLayer();
  const catalog = useProviderCatalog();
  const [projectRoot, setProjectRoot] = useState(noProject);
  const projects = useQuery({
    queryKey: ["backlog", "projects"],
    queryFn: async () => (await paseo.projects.list()).projects,
  });
  const preview = useQuery({
    queryKey: ["backlog", "preview", projectRoot, personal.revision],
    queryFn: () => fetchPreview({ projectRoot: projectRoot === noProject ? null : projectRoot }),
    enabled: personal.status === "ready",
  });

  const save = async (next: ConfigLayer) => {
    const ok = await personal.save(next);
    if (ok) {
      toast.show("Saved. Open boards refresh on their own.", { variant: "success" });
    } else {
      toast.error(personal.saveError ?? "Not saved, try again.");
    }
  };

  const renderForms = () => {
    if (personal.status === "loading" || !preview.data) {
      return <Text style={styles.muted}>Loading…</Text>;
    }
    if (personal.error) {
      return <Text style={styles.danger}>Could not read your backlog config: {personal.error}</Text>;
    }
    const repoLayer = parseLayer(preview.data.repo?.value);
    const disabled = personal.isBroken;
    return (
      <>
        {preview.data.problems.length > 0 ? (
          <View style={[styles.card, { borderColor: theme.colors.statusWarning }]}>
            {preview.data.problems.map((problem) => (
              <Text key={`${problem.source}:${problem.message}`} selectable style={styles.muted}>
                {problem.skipped ? "Skipped" : "Warning"} · {problem.source}: {problem.message}
              </Text>
            ))}
          </View>
        ) : null}
        {disabled ? (
          <Text style={styles.danger}>
            Your saved config isn't valid, so these forms are read-only. Fix it under Advanced.
          </Text>
        ) : null}
        <ActionsSettings
          rows={describeActions(repoLayer, personal.layer)}
          layer={personal.layer}
          statuses={preview.data.config.tracker.statuses.map((status) => status.name)}
          catalog={catalog.data ?? []}
          styles={styles}
          disabled={disabled}
          onSave={(next) => void save(next)}
        />
        <TrackerSettings
          key={`${projectRoot}:${personal.revision}`}
          effective={preview.data.config.tracker}
          layer={personal.layer}
          styles={styles}
          disabled={disabled}
          onSave={(next) => void save(next)}
        />
      </>
    );
  };

  const projectOptions = [
    { value: noProject, label: "None, built-in only" },
    ...(projects.data ?? []).map((project) => ({ value: project.projectRootPath, label: project.projectDisplayName })),
  ];

  return (
    <View style={{ gap: 24 }}>
      <SettingsSection title="Preview with a project">
        <SettingsCard>
          <SettingsRow
            label="Project"
            hint="Your changes apply everywhere. Picking a project shows them on top of that repo's paseo.json."
          >
            <Chips options={projectOptions} value={projectRoot} styles={styles} onChange={setProjectRoot} />
          </SettingsRow>
          {preview.data?.repo ? (
            <SettingsRow
              label="Team config"
              hint={teamConfigHint(preview.data.repo)}
            />
          ) : null}
        </SettingsCard>
      </SettingsSection>
      {renderForms()}
      <AdvancedConfigSection theme={theme} compact={compact} />
    </View>
  );
};
