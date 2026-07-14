import test from "node:test";
import assert from "node:assert/strict";
import { synthesizeTickets } from "../src/review/review.js";

test("new ticket IDs advance from the highest existing numeric suffix", () => {
  const state = { schema_version: "1.0.0", tickets: [
    { id: "B01-T001", severity: "low", category: "x", chapter: null, evidence: "x", problem: "one", required_change: "x", protected_constraints: [], acceptance_tests: [], status: "closed" },
    { id: "B01-T010", severity: "low", category: "y", chapter: null, evidence: "x", problem: "two", required_change: "x", protected_constraints: [], acceptance_tests: [], status: "closed" },
  ] } as const;
  const next = synthesizeTickets(structuredClone(state) as never, [{ severity: "medium", category: "z", chapter: 2, evidence: "e", problem: "three", requiredChange: "fix", acceptanceTests: ["passes"] }], 1);
  assert.equal(next.tickets.at(-1)?.id, "B01-T011");
});
