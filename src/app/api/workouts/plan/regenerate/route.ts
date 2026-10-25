// Backward route remains valid, but unreviewed template writes are retired.
// Clients must submit the same explicit request/consent contract as the planner.
export { POST } from "@/app/api/ai/planning/route";

export const maxDuration=120;
