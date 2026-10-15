import { useAgent } from "@getpaseo/plugin/client";
import { Pressable, Text, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import type { AgentLink } from "../shared/rpc";
import type { Styles } from "./styles";

type AgentState = { status: string; requiresAttention: boolean; attentionReason: string | null } | null;

const describe = (agent: AgentState) => {
  if (!agent || agent.status === "closed") {
    return { label: "Agent stopped", tone: "muted" as const };
  }
  if (agent.attentionReason === "permission") {
    return { label: "Waiting for permission", tone: "warning" as const };
  }
  if (agent.status === "error" || agent.attentionReason === "error") {
    return { label: "Agent failed", tone: "danger" as const };
  }
  if (agent.status === "running") {
    return { label: "Agent running", tone: "success" as const };
  }
  if (agent.status === "initializing") {
    return { label: "Agent starting", tone: "success" as const };
  }
  if (agent.attentionReason === "finished") {
    return { label: "Agent finished", tone: "success" as const };
  }
  return { label: "Agent idle", tone: "muted" as const };
};

export const AgentBadge = ({
  link,
  theme,
  styles,
  onOpen,
}: {
  link: AgentLink;
  theme: PluginTheme;
  styles: Styles;
  onOpen: ((agentId: string) => void) | null;
}) => {
  const agent = useAgent(link.agentId, ({ status, requiresAttention, attentionReason }) => ({
    status,
    requiresAttention,
    attentionReason,
  }));
  const { label, tone } = describe(agent);
  const colors = {
    muted: theme.colors.foregroundMuted,
    warning: theme.colors.statusWarning,
    danger: theme.colors.statusDanger,
    success: theme.colors.statusSuccess,
  };
  const badge = (
    <View style={styles.row}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[tone] }} />
      <Text style={[styles.muted, { color: colors[tone] }]}>{label}</Text>
    </View>
  );

  if (!agent || !onOpen) {
    return badge;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, open agent`} onPress={() => onOpen(link.agentId)}>
      {badge}
    </Pressable>
  );
};
