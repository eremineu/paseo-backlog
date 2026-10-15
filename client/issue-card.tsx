import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import type { Card } from "../shared/issues";
import type { AgentLink } from "../shared/rpc";
import { AgentBadge } from "./agent-badge";
import type { Styles } from "./styles";

export interface CardActions {
  onStatus: (card: Card) => void;
  onView: (card: Card) => void;
  onPick: (card: Card) => void;
  onPickWithOptions: (card: Card) => void;
  onHelp: (card: Card) => void;
  onOpenAgent: ((agentId: string) => void) | null;
}

export const IssueCard = ({
  card,
  link,
  busy,
  theme,
  styles,
  actions,
}: {
  card: Card;
  link: AgentLink | undefined;
  busy: boolean;
  theme: PluginTheme;
  styles: Styles;
  actions: CardActions;
}) => (
  <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open issue ${card.id}`} onPress={() => actions.onView(card)}>
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
        {link ? <AgentBadge link={link} theme={theme} styles={styles} onOpen={actions.onOpenAgent} /> : null}
      </View>

      <View style={styles.row}>
        {card.canHelp ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => actions.onHelp(card)}
            style={[styles.button, { opacity: busy ? 0.5 : 1 }]}
          >
            <Text style={styles.buttonText}>Help me</Text>
          </Pressable>
        ) : null}
        {card.canPick ? (
          <View style={[styles.row, { gap: 2 }]}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => actions.onPick(card)}
              style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}
            >
              <Text style={styles.primaryButtonText}>{busy ? "Starting…" : "Pick"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick with options"
              disabled={busy}
              onPress={() => actions.onPickWithOptions(card)}
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
