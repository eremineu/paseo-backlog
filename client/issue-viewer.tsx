import { useRpc } from "@getpaseo/plugin/client";
import { Modal, copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { readIssue } from "../shared/rpc";
import { backlogKey } from "./use-backlog";
import type { Styles } from "./styles";

// Paseo has no plugin API for opening a file in the Files tab, so the issue is shown here as plain text.
export const IssueViewer = ({
  projectRoot,
  effort,
  file,
  title,
  styles,
  onClose,
}: {
  projectRoot: string;
  effort: string;
  file: string;
  title: string;
  styles: Styles;
  onClose: () => void;
}) => {
  const fetchIssue = useRpc(readIssue);
  const toast = useToast();
  const issue = useQuery({
    queryKey: [...backlogKey(projectRoot), "issue", effort, file],
    queryFn: () => fetchIssue({ projectRoot, effort, file }),
  });

  const copyPath = async (path: string) => {
    try {
      await copyText(path);
      toast.show("Path copied", { variant: "success" });
    } catch {
      toast.error("Could not copy. Select the path and use Copy.");
    }
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
        {issue.data ? (
          <View style={{ gap: 12 }}>
            <View style={styles.row}>
              <Text selectable style={[styles.mono, { flexShrink: 1 }]}>
                {issue.data.path}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => void copyPath(issue.data.path)} style={styles.button}>
                <Text style={styles.buttonText}>Copy path</Text>
              </Pressable>
            </View>
            <Text selectable style={styles.mono}>
              {issue.data.text}
            </Text>
          </View>
        ) : (
          <Text style={issue.error ? styles.danger : styles.muted}>
            {issue.error ? String(issue.error) : "Loading…"}
          </Text>
        )}
      </Modal.Content>
    </Modal>
  );
};
