import { Modal } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import type { ActionConfig } from "../shared/config";
import type { Styles } from "./styles";

// Every action that applies to the card, each runnable as configured or with options first.
export const ActionMenu = ({
  title,
  actions,
  styles,
  onRun,
  onOptions,
  onClose,
}: {
  title: string;
  actions: readonly ActionConfig[];
  styles: Styles;
  onRun: (action: ActionConfig) => void;
  onOptions: (action: ActionConfig) => void;
  onClose: () => void;
}) => (
  <Modal
    title={title}
    open
    onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
  >
    <Modal.Content contentContainerStyle={{ padding: 16, gap: 8 }}>
      {actions.map((action, index) => (
        <View key={action.id} style={[styles.row, { justifyContent: "space-between" }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onRun(action)}
            style={[index === 0 ? styles.primaryButton : styles.button, { flexGrow: 1 }]}
          >
            <Text style={index === 0 ? styles.primaryButtonText : styles.buttonText}>{action.label}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onOptions(action)} style={styles.button}>
            <Text style={styles.buttonText}>Options…</Text>
          </Pressable>
        </View>
      ))}
    </Modal.Content>
  </Modal>
);
