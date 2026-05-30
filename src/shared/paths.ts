import { join } from "node:path";

export function getAppDataRoot(env = process.env): string {
  const appData = env.APPDATA ?? join(env.USERPROFILE ?? process.cwd(), "AppData", "Roaming");
  return join(appData, "cline-desktop-pet");
}

export function getPaths(env = process.env) {
  const root = getAppDataRoot(env);
  return {
    root,
    logs: join(root, "logs"),
    petPacks: join(root, "pets"),
    stateFile: join(root, "state.json"),
    profileMemoryFile: join(root, "profile.json"),
    relationshipMemoryFile: join(root, "relationship.json"),
    contextMemoryFile: join(root, "context-memory.jsonl"),
    appLog: join(root, "logs", "pet-app.log"),
    mcpLog: join(root, "logs", "mcp-server.log")
  };
}