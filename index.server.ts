import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  checkPersonalConfig,
  listEfforts,
  previewConfig,
  listLinks,
  readBoard,
  readIssue,
  saveLink,
  setStatus,
  waitForChange,
} from "./shared/rpc";
import { personalConfig } from "./shared/settings";
import * as configFiles from "./server/config";
import { createLinkStore } from "./server/links";
import * as tracker from "./server/tracker";

// Paseo reads the default export eagerly, before a `const` is initialised, so this must be a hoisted function.
export default function contribute(server: PluginServerContext) {
  const feed = tracker.createChangeFeed();
  const links = createLinkStore();
  const personal = server.registerSettings(personalConfig);

  const personalJson = async () => {
    const state = await personal.read();
    return state.status === "ready" ? state.values.json : "";
  };
  const configFor = async (projectRoot: string) => {
    tracker.assertProjectRoot(projectRoot);
    return configFiles.loadConfig(projectRoot, await personalJson());
  };

  const stopWatchingSettings = personal.subscribe(() => feed.bumpAll());

  server.handle(listEfforts, async ({ projectRoot }) => {
    const { config, problems } = await configFor(projectRoot);
    const { folder } = config.tracker;
    return { efforts: await tracker.listEfforts(projectRoot, folder), folder, problems };
  });
  server.handle(readBoard, async ({ projectRoot, effort }) => {
    const { config, problems } = await configFor(projectRoot);
    return { ...(await tracker.readBoard(projectRoot, effort, config)), config, problems };
  });
  server.handle(waitForChange, async ({ projectRoot, version }) => {
    const { config } = await configFor(projectRoot);
    return feed.waitForChange(projectRoot, config.tracker.folder, version);
  });
  server.handle(setStatus, async ({ projectRoot, effort, file, status, restore }) => {
    const { config } = await configFor(projectRoot);
    return tracker.setStatus(projectRoot, config, effort, file, status, restore);
  });
  server.handle(readIssue, async ({ projectRoot, effort, file }) => {
    const { config } = await configFor(projectRoot);
    return tracker.readIssue(projectRoot, config.tracker.folder, effort, file);
  });
  server.handle(listLinks, async ({ projectRoot, effort }) => {
    const { config } = await configFor(projectRoot);
    return { links: await links.linksUnder(tracker.issuesDirOf(projectRoot, config.tracker.folder, effort)) };
  });
  server.handle(saveLink, async ({ projectRoot, effort, file, link }) => {
    const { config } = await configFor(projectRoot);
    await links.save(tracker.issuePathOf(projectRoot, config.tracker.folder, effort, file), link);
    return {};
  });
  server.handle(checkPersonalConfig, ({ json }) => configFiles.checkPersonalConfig(json));
  server.handle(previewConfig, async ({ projectRoot }) => {
    if (projectRoot) {
      tracker.assertProjectRoot(projectRoot);
    }
    return configFiles.previewConfig(projectRoot, await personalJson());
  });

  return () => {
    stopWatchingSettings();
    feed.close();
  };
}
