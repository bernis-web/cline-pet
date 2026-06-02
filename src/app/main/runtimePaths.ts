import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type RuntimePathOptions = {
  appRoot: string;
  devServerUrl?: string;
};

export function getDefaultPetPackDir(options: RuntimePathOptions) {
  return join(options.appRoot, "dist/assets/default-pet");
}

export function getRendererUrl(options: RuntimePathOptions) {
  if (options.devServerUrl) return options.devServerUrl;
  return pathToFileURL(join(options.appRoot, "dist/app/renderer/index.html")).toString();
}