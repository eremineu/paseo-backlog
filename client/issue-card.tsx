import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import type { ActionConfig } from "../shared/config";
import type { Card } from "../shared/issues";
import type { AgentLink } from "../shared/rpc";
import type { AgentState } from "./use-agent-states";
import { AgentBadge } from "./agent-badge";
import type { Styles } from "./styles";

export interface CardActions {
  onStatus: (card: Card) => void;
  onView: (card: Card) => void;
  onRun: (card: Card, action: ActionConfig) => void;
  onOptions: (card: Card) => void;
  onOpenAgent: ((agentId: string) => void) | null;
}

export const IssueCard = ({
  card,
  cardActions,
  link,
  agent,
  busy,
  theme,
  styles,
  actions,
}: {
  card: Card;
  cardActions: readonly ActionConfig[];
  link: AgentLink | undefined;
  agent: AgentState | null;
  busy: boolean;
  theme: PluginTheme;
  styles: Styles;
  actions: CardActions;
}) => {
  const [primary] = cardActions;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open issue ${card.id}`}
        onPress={() => actions.onView(card)}
      >
        <Text style={styles.text}>
          <Text style={styles.muted}>#{card.id} </Text>
          {card.title}
        </Text>
      </Pressable>

      {card.summary ? (
        <Text style={styles.muted} numberOfLines={2}>
          {card.summary}
        </Text>
      ) : null}

      {card.waitingFor.length > 0 ? (
        <Text style={styles.muted}>
          Waiting on {card.waitingFor.map((blocker) => `#${blocker.id} ${blocker.title}`).join(", ")}
        </Text>
      ) : null}

      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Status ${card.status}, change`}
            onPress={() => actions.onStatus(card)}
            style={styles.chip}
          >
            <View style={styles.row}>
              <Text style={styles.chipText}>{card.status}</Text>
              <Icon name="ChevronDown" size={12} color={theme.colors.foregroundMuted} />
            </View>
          </Pressable>
          {link ? (
            <AgentBadge link={link} agent={agent} theme={theme} styles={styles} onOpen={actions.onOpenAgent} />
          ) : null}
        </View>

        <View style={styles.row}>
          {primary ? (
            <View style={[styles.row, { gap: 2 }]}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => actions.onRun(card, primary)}
                style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}
              >
                <Text style={styles.primaryButtonText}>{busy ? "Starting…" : primary.label}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${primary.label} with options`}
                disabled={busy}
                onPress={() => actions.onOptions(card)}
                style={[styles.primaryButton, { paddingHorizontal: 6, opacity: busy ? 0.5 : 1 }]}
              >
                <Icon name="ChevronDown" size={14} color={theme.colors.accentForeground} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};
