import { type PluginScreenProps, type PluginSidebarItemProps, usePaseo } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import { BacklogBoard } from "./board";
import { Chips } from "./chips";
import { useStyles } from "./styles";

export const boardScreenId = "board";

// The same board as the workspace tab, for any registered project, without opening a workspace first.
export const BoardScreen = ({ theme, layout, navigation }: PluginScreenProps) => {
  const styles = useStyles(theme, layout.compact);
  const paseo = usePaseo();
  const projects = useQuery({
    queryKey: ["backlog", "projects"],
    queryFn: async () => (await paseo.projects.list()).projects,
  });
  const [chosenRoot, setChosenRoot] = useState<string | null>(null);
  const entries = projects.data ?? [];
  const project = entries.find((entry) => entry.projectRootPath === chosenRoot) ?? entries[0] ?? null;

  if (!project) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={projects.error ? styles.danger : styles.muted}>
          {projects.isLoading ? "Loading…" : "No projects registered in Paseo."}
        </Text>
      </View>
    );
  }

  const picker =
    entries.length > 1 ? (
      <Chips
        options={entries.map((entry) => ({ value: entry.projectRootPath, label: entry.projectDisplayName }))}
        value={project.projectRootPath}
        styles={styles}
        onChange={setChosenRoot}
      />
    ) : null;

  return (
    <BacklogBoard
      key={project.projectRootPath}
      projectRoot={project.projectRootPath}
      isGit={project.projectKind === "git"}
      theme={theme}
      layout={layout}
      navigation={navigation}
      header={picker}
    />
  );
};

export const BoardSidebarItem = ({ currentScreen, openScreen }: PluginSidebarItemProps) => (
  <SidebarRow
    icon="KanbanSquare"
    active={currentScreen?.screenId === boardScreenId}
    onPress={() => openScreen({ screenId: boardScreenId })}
  />
);
