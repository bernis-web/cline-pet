export type ProfileMemory = {
  displayName?: string;
  preferredAddress?: string;
  likes: string[];
  dislikes: string[];
  habits: string[];
  topics: string[];
  notes: string[];
  updatedAt: string;
};

export type RelationshipMemory = {
  familiarity: number;
  affection: number;
  engagement: number;
  trust: number;
  lastInteractionAt?: string;
  recentEvents: { text: string; createdAt: string; weight: number }[];
  updatedAt: string;
};

export type ContextMemoryItem = {
  id: string;
  kind: "conversation-summary" | "fact" | "preference" | "project-context";
  text: string;
  tags: string[];
  sourceConversationId?: string;
  lastAccessedAt?: string;
  weight: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryPromptContext = {
  profileSummary: string | null;
  relationshipSummary: string | null;
  retrievedMemories: ContextMemoryItem[];
};