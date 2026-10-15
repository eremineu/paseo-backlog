import { Pressable, Text, View } from "react-native";
import type { Styles } from "./styles";

export const Chips = <Value extends string>({
  options,
  value,
  styles,
  onChange,
}: {
  options: readonly { value: Value; label: string }[];
  value: Value | null;
  styles: Styles;
  onChange: (value: Value) => void;
}) => (
  <View style={styles.row}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          onPress={() => onChange(option.value)}
          style={active ? styles.chipActive : styles.chip}
        >
          <Text style={active ? styles.chipTextActive : styles.chipText}>{option.label}</Text>
        </Pressable>
      );
    })}
  </View>
);
