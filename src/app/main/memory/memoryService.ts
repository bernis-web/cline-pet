import type { ContextMemoryItem, MemoryPromptContext, ProfileMemory, RelationshipMemory } from "./memoryTypes.js";

export function buildMemoryPromptContext(input: {
  profile: ProfileMemory;
  relationship: RelationshipMemory;
  memories: ContextMemoryItem[];
}): MemoryPromptContext {
  const profileSummary = [
    input.profile.preferredAddress && `preferredAddress=${input.profile.preferredAddress}`,
    input.profile.likes.length > 0 && `likes=${input.profile.likes.join("/")}`
  ].filter(Boolean).join("; ") || null;

  const relationshipSummary = `familiarity=${input.relationship.familiarity} affection=${input.relationship.affection} engagement=${input.relationship.engagement} trust=${input.relationship.trust}`;

  return {
    profileSummary,
    relationshipSummary,
    retrievedMemories: input.memories.slice(0, 3)
  };
}