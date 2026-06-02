import type { ContextMemoryItem } from "./memoryTypes.js";

function tokenize(input: string) {
  return input.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function searchContextMemories(items: ContextMemoryItem[], query: string, limit: number) {
  const terms = tokenize(query);
  return [...items]
    .map((item) => {
      const haystack = `${item.text} ${item.tags.join(" ")}`.toLowerCase();
      const hits = terms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0);
      return { item, score: item.weight + hits * 50 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.item.createdAt.localeCompare(a.item.createdAt))
    .slice(0, limit)
    .map((entry) => entry.item);
}