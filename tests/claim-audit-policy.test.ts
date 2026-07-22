import test from "node:test";
import assert from "node:assert/strict";
import { shouldRunClaimAudit } from "../src/application/claim-audit.js";

const cases = [
  [{ tier: "balanced", factChecking: "risk-based", riskLevel: "high", historical: false }, true],
  [{ tier: "balanced", factChecking: "risk-based", riskLevel: "high", historical: true }, true],
  [{ tier: "balanced", factChecking: "risk-based", riskLevel: "low", historical: true }, true],
  [{ tier: "balanced", factChecking: "always", riskLevel: "low", historical: false }, true],
  [{ tier: "balanced", factChecking: "risk-based", riskLevel: "medium", historical: false }, false],
  [{ tier: "premium", factChecking: "risk-based", riskLevel: "medium", historical: false }, true],
  [{ tier: "premium", factChecking: "risk-based", riskLevel: "low", historical: false }, false],
  [{ tier: "editorial", factChecking: "risk-based", riskLevel: "low", historical: false }, true],
  [{ tier: "premium", factChecking: "always", riskLevel: "low", historical: false }, true],
  [{ tier: "editorial", factChecking: "off", riskLevel: "high", historical: true }, false],
] as const;

for (const [input, expected] of cases) {
  test(`claim audit policy ${JSON.stringify(input)} => ${expected}`, () => {
    assert.equal(shouldRunClaimAudit(input), expected);
  });
}
