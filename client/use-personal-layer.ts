import { useSettings } from "@getpaseo/plugin/client";
import type { ConfigLayer } from "../shared/config";
import { layerToJson, parseLayer } from "../shared/layers";
import { personalConfig } from "../shared/settings";

const parseJson = (json: string): unknown => {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
};

// The personal layer as an object the forms can edit. When the saved JSON doesn't parse, the forms
// stay read-only and the Advanced editor is the way to fix it, so a broken draft is never overwritten.
export const usePersonalLayer = () => {
  const settings = useSettings(personalConfig);
  const json = settings.status === "ready" ? settings.values.json : "";
  const isEmpty = json.trim() === "";
  const layer = isEmpty ? null : parseLayer(parseJson(json));
  const isBroken = !isEmpty && layer === null;

  const save = async (next: ConfigLayer) => {
    if (settings.status !== "ready") {
      return false;
    }
    return settings.save({ json: layerToJson(next) }, settings.revision);
  };

  return {
    status: settings.status,
    error: settings.status === "error" ? settings.error : null,
    revision: settings.status === "ready" ? settings.revision : null,
    json,
    layer,
    isBroken,
    save,
    saveError: settings.saveError,
  };
};
