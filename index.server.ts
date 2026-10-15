import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createLinkStore } from "./server/links";
import * as tracker from "./server/tracker";
import { listEfforts, listLinks, readBoard, readIssue, saveLink, setStatus, waitForChange } from "./shared/rpc";

// Paseo reads the default export eagerly, before a `const` is initialised, so this must be a hoisted function.
export default function contribute(server: PluginServerContext) {
  const feed = tracker.createChangeFeed();
  const links = createLinkStore();

  server.handle(listEfforts, async ({ projectRoot }) => ({ efforts: await tracker.listEfforts(projectRoot) }));
  server.handle(readBoard, ({ projectRoot, effort }) => tracker.readBoard(projectRoot, effort));
  server.handle(waitForChange, ({ projectRoot, version }) => feed.waitForChange(projectRoot, version));
  server.handle(setStatus, ({ projectRoot, effort, file, status }) =>
    tracker.setStatus(projectRoot, effort, file, status),
  );
  server.handle(readIssue, ({ projectRoot, effort, file }) => tracker.readIssue(projectRoot, effort, file));
  server.handle(listLinks, async ({ projectRoot, effort }) => ({
    links: await links.linksUnder(tracker.issuesDirOf(projectRoot, effort)),
  }));
  server.handle(saveLink, async ({ projectRoot, effort, file, link }) => {
    await links.save(tracker.issuePathOf(projectRoot, effort, file), link);
    return {};
  });

  return () => feed.close();
}
