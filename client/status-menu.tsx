import { Modal } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text } from "react-native";
import { type Status, statuses } from "../shared/issues";
import type { Styles } from "./styles";

export const StatusMenu = ({
  title,
  current,
  styles,
  onPick,
  onClose,
}: {
  title: string;
  current: string;
  styles: Styles;
  onPick: (status: Status) => void;
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
    <Modal.Content contentContainerStyle={{ padding: 16, gap: 6 }}>
      {statuses.map((status) => {
        const active = status === current;
        return (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onPick(status)}
            style={active ? styles.primaryButton : styles.button}
          >
            <Text style={active ? styles.primaryButtonText : styles.buttonText}>{status}</Text>
          </Pressable>
        );
      })}
    </Modal.Content>
  </Modal>
);
