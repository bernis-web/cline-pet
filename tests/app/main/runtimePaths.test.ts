import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDefaultPetPackDir, getRendererUrl } from "../../../src/app/main/runtimePaths";

function unixify(value: string) {
  return value.replaceAll("\\", "/");
}

describe("runtime release paths", () => {
  it("uses bundled resources when the app is packaged", () => {
    const appRoot = "C:/Users/me/AppData/Local/Programs/cline-desktop-pet/resources/app.asar";

    expect(unixify(getDefaultPetPackDir({ appRoot }))).toBe(
      "C:/Users/me/AppData/Local/Programs/cline-desktop-pet/resources/app.asar/dist/assets/default-pet"
    );
    expect(unixify(getRendererUrl({ appRoot }))).toBe(
      "file:///C:/Users/me/AppData/Local/Programs/cline-desktop-pet/resources/app.asar/dist/app/renderer/index.html"
    );
  });

  it("keeps the Vite dev server override for local development", () => {
    expect(getRendererUrl({
      appRoot: join("D:/projects/cline-desktop-pet"),
      devServerUrl: "http://127.0.0.1:5173"
    })).toBe("http://127.0.0.1:5173");
  });
});