import { type PluginWorkspacePanelProps, useWorkspace } from "@getpaseo/plugin/client";
import { Text, View } from "react-native";
import { BacklogBoard } from "./board";
import { useStyles } from "./styles";

export const BoardPanel = ({ theme, layout, workspaceId, navigation }: PluginWorkspacePanelProps) => {
  const styles = useStyles(theme, layout.compact);
  const project = useWorkspace(workspaceId, ({ projectRootPath, projectKind }) => ({ projectRootPath, projectKind }));

  if (!project) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.muted}>Workspace not loaded yet.</Text>
      </View>
    );
  }
  return (
    <BacklogBoard
      projectRoot={project.projectRootPath}
      isGit={project.projectKind === "git"}
      theme={theme}
      layout={layout}
      navigation={navigation}
    />
  );
};
