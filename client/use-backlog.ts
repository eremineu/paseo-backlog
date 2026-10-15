import { useRpc } from "@getpaseo/plugin/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listEfforts, listLinks, readBoard, waitForChange } from "../shared/rpc";

export const backlogKey = (projectRoot: string) => ["backlog", projectRoot];

// Keeps a long poll open against the daemon and refetches the board whenever `.scratch/` changes.
const useLiveTracker = (projectRoot: string | null) => {
  const queryClient = useQueryClient();
  const wait = useRpc(waitForChange);

  useEffect(() => {
    if (!projectRoot) {
      return;
    }
    let stopped = false;
    let version = 0;
    const loop = async () => {
      while (!stopped) {
        try {
          const next = await wait({ projectRoot, version });
          if (!stopped && next.version !== version) {
            version = next.version;
            await queryClient.invalidateQueries({ queryKey: backlogKey(projectRoot) });
          }
        } catch {
          await new Promise<void>((resolve) => setTimeout(resolve, 3_000));
        }
      }
    };
    void loop();
    return () => {
      stopped = true;
    };
  }, [projectRoot, wait, queryClient]);
};

export const useBacklog = (projectRoot: string | null) => {
  const fetchEfforts = useRpc(listEfforts);
  const fetchBoard = useRpc(readBoard);
  const fetchLinks = useRpc(listLinks);
  const [chosenEffort, setChosenEffort] = useState<string | null>(null);

  useLiveTracker(projectRoot);

  const efforts = useQuery({
    queryKey: [...backlogKey(projectRoot ?? ""), "efforts"],
    queryFn: () => fetchEfforts({ projectRoot: projectRoot ?? "" }),
    enabled: projectRoot !== null,
  });

  const effortNames = efforts.data?.efforts ?? [];
  const effort = chosenEffort && effortNames.includes(chosenEffort) ? chosenEffort : (effortNames[0] ?? null);

  // Efforts reorder whenever one changes; pin the default so the board doesn't jump to another effort.
  useEffect(() => {
    if (effort !== null && effort !== chosenEffort) {
      setChosenEffort(effort);
    }
  }, [effort, chosenEffort]);

  const board = useQuery({
    queryKey: [...backlogKey(projectRoot ?? ""), "board", effort],
    queryFn: () => fetchBoard({ projectRoot: projectRoot ?? "", effort: effort ?? "" }),
    enabled: projectRoot !== null && effort !== null,
  });

  const links = useQuery({
    queryKey: [...backlogKey(projectRoot ?? ""), "links", effort],
    queryFn: () => fetchLinks({ projectRoot: projectRoot ?? "", effort: effort ?? "" }),
    enabled: projectRoot !== null && effort !== null,
  });

  return { efforts, effortNames, effort, setEffort: setChosenEffort, board, links: links.data?.links ?? {} };
};
