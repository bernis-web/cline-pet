export const DEFAULT_PET_PACK_ID = "default-pixel-dev";
export const PREFERRED_LOCAL_PET_PACK_ID = "kaka-desktop-pet";

export function chooseInitialPetPackId(savedId: string | null, availablePackIds: string[]) {
  if (savedId && availablePackIds.includes(savedId)) return savedId;
  if (!savedId && availablePackIds.includes(PREFERRED_LOCAL_PET_PACK_ID)) return PREFERRED_LOCAL_PET_PACK_ID;
  return DEFAULT_PET_PACK_ID;
}