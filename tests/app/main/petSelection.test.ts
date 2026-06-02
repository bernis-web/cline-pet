import { describe, expect, it } from "vitest";
import { chooseInitialPetPackId } from "../../../src/app/main/petSelection";

describe("initial pet pack selection", () => {
  it("uses Kaka when no saved selection exists and Kaka is available", () => {
    expect(chooseInitialPetPackId(null, ["default-pixel-dev", "kaka-desktop-pet"])).toBe("kaka-desktop-pet");
  });

  it("falls back to the default pet when no saved selection exists and Kaka is missing", () => {
    expect(chooseInitialPetPackId(null, ["default-pixel-dev"])).toBe("default-pixel-dev");
  });

  it("keeps a valid saved selection", () => {
    expect(chooseInitialPetPackId("custom-pet", ["default-pixel-dev", "kaka-desktop-pet", "custom-pet"])).toBe("custom-pet");
  });

  it("falls back to default when the saved selection is stale", () => {
    expect(chooseInitialPetPackId("missing-pet", ["default-pixel-dev", "kaka-desktop-pet"])).toBe("default-pixel-dev");
  });
});