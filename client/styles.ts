import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo } from "react";

export const useStyles = (theme: PluginTheme, compact: boolean) =>
  useMemo(
    () => ({
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: compact ? 12 : 20, gap: compact ? 12 : 16 },
      row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, flexWrap: "wrap" as const },
      title: { color: theme.colors.foreground, fontSize: compact ? 18 : 20, fontWeight: "600" as const },
      sectionTitle: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
        fontWeight: "600" as const,
        letterSpacing: 0.5,
        textTransform: "uppercase" as const,
      },
      text: { color: theme.colors.foreground, fontSize: 14 },
      muted: { color: theme.colors.foregroundMuted, fontSize: 13 },
      danger: { color: theme.colors.statusDanger, fontSize: 13 },
      mono: { color: theme.colors.foreground, fontSize: 12, fontFamily: "Menlo" },
      card: {
        backgroundColor: theme.colors.surface1,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 10,
        padding: compact ? 10 : 14,
        gap: 8,
      },
      chip: {
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: theme.colors.surface2,
      },
      chipActive: {
        borderColor: theme.colors.accent,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: theme.colors.accent,
      },
      chipText: { color: theme.colors.foreground, fontSize: 12 },
      chipTextActive: { color: theme.colors.accentForeground, fontSize: 12 },
      primaryButton: {
        backgroundColor: theme.colors.accent,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
      },
      primaryButtonText: { color: theme.colors.accentForeground, fontSize: 13, fontWeight: "600" as const },
      button: {
        backgroundColor: theme.colors.surface2,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
      },
      buttonText: { color: theme.colors.foreground, fontSize: 13 },
      input: {
        color: theme.colors.foreground,
        backgroundColor: theme.colors.surface2,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 14,
      },
    }),
    [theme, compact],
  );

export type Styles = ReturnType<typeof useStyles>;
