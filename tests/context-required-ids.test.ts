import test from "node:test";
import assert from "node:assert/strict";
import { assertRequiredContextIds } from "../src/context/context-distiller.js";

test("required record ids must exist before context rendering", () => {
  assert.doesNotThrow(() => assertRequiredContextIds(["CAN-001", "THR-002"], new Set(["CAN-001", "THR-002", "RES-003"])));
  assert.throws(
    () => assertRequiredContextIds(["CAN-001", "THR-999", "RES-404"], new Set(["CAN-001"])),
    /Missing required context record IDs: RES-404, THR-999/,
  );
});

test("required id failures are sorted and deterministic", () => {
  let first = "";
  let second = "";
  try { assertRequiredContextIds(["Z-2", "A-1", "Z-2"], new Set()); } catch (error) { first = error instanceof Error ? error.message : String(error); }
  try { assertRequiredContextIds(["A-1", "Z-2"], new Set()); } catch (error) { second = error instanceof Error ? error.message : String(error); }
  assert.equal(first, second);
});
