import type { PluginClientContext } from "@getpaseo/plugin/client";
import { BoardPanel } from "./client/board-panel";
import { BoardScreen, BoardSidebarItem, boardScreenId } from "./client/board-screen";
import { SettingsScreen } from "./client/settings-screen";

// Paseo reads the default export eagerly, before a `const` is initialised, so this must be a hoisted function.
export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({
    id: "board",
    title: "Backlog",
    icon: "KanbanSquare",
    context: "workspace",
    Component: BoardPanel,
  });
  client.addScreen({ id: boardScreenId, title: "Backlog", Component: BoardScreen });
  client.addSidebarHeaderItem({ id: "board", title: "Backlog", Component: BoardSidebarItem });
  client.addCommandCenterItem({
    id: "open-board",
    title: "Open backlog",
    icon: "KanbanSquare",
    keywords: ["tasks", "issues", "scratch"],
    context: "workspace",
    onSelect: ({ openPanel }) => openPanel("board"),
  });
  client.addCommandCenterItem({
    id: "open-board-screen",
    title: "Open backlog for any project",
    icon: "KanbanSquare",
    keywords: ["tasks", "issues", "scratch"],
    context: "global",
    onSelect: ({ openScreen }) => openScreen({ screenId: boardScreenId }),
  });
  client.addSettingsScreen({ id: "agent", title: "Backlog agent", icon: "Bot", Component: SettingsScreen });
  return () => {};
}
