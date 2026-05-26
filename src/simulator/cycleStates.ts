import { PET_STATUSES } from "../shared/statuses.js";

const port = Number(process.env.CLINE_PET_BRIDGE_PORT ?? "37621");

for (const status of PET_STATUSES) {
  const payload = { status, task: `Simulating ${status}`, message: `Pet state: ${status}`, source: "simulator", updatedAt: new Date().toISOString() };
  const response = await fetch(`http://127.0.0.1:${port}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  console.log(status, response.status, await response.text());
  await new Promise((resolve) => setTimeout(resolve, 1500));
}