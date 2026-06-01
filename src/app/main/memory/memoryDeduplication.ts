import type { ContextMemoryItem } from "./memoryTypes.js";

export function normalizeMemoryText(text: string) {
  return text.toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "").trim();
}

function overlapScore(a: string, b: string) {
  const aTerms = new Set(a.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const bTerms = new Set(b.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  if (!aTerms.size || !bTerms.size) return 0;
  const hits = [...aTerms].filter((term) => bTerms.has(term)).length;
  return hits / Math.max(aTerms.size, bTerms.size);
}

export function mergeContextMemory(existing: ContextMemoryItem[], candidate: ContextMemoryItem): ContextMemoryItem[] {
  const normalizedCandidate = normalizeMemoryText(candidate.text);
  const matchIndex = existing.findIndex((item) => {
    if (item.kind !== candidate.kind) return false;
    if (normalizeMemoryText(item.text) === normalizedCandidate) return true;
    return overlapScore(item.text, candidate.text) >= 0.75;
  });
  if (matchIndex === -1) return [candidate, ...existing];

  return existing.map((item, index) => index === matchIndex
    ? {
        ...item,
        tags: Array.from(new Set([...item.tags, ...candidate.tags])),
        weight: Math.max(item.weight, candidate.weight),
        updatedAt: candidate.updatedAt,
        lastAccessedAt: candidate.updatedAt
      }
    : item);
}