import type { PluginClientContext } from "@getpaseo/plugin/client";
import { BoardPanel } from "./client/board-panel";
import { SettingsScreen } from "./client/settings-screen";

const contribute = (client: PluginClientContext) => {
  client.addWorkspacePanel({
    id: "board",
    title: "Backlog",
    icon: "KanbanSquare",
    context: "workspace",
    Component: BoardPanel,
  });
  client.addCommandCenterItem({
    id: "open-board",
    title: "Open backlog",
    icon: "KanbanSquare",
    keywords: ["tasks", "issues", "scratch"],
    context: "workspace",
    onSelect: ({ openPanel }) => openPanel("board"),
  });
  client.addSettingsScreen({ id: "agent", title: "Backlog agent", icon: "Bot", Component: SettingsScreen });
  return () => {};
};

export default contribute;
