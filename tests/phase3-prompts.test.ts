import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookPlanPrompt, queuePrompt, readerTestPrompt, reviewPrompt } from "../src/application/prompts.js";
import { initializeProject } from "../src/project/store.js";

test("book planning explains research provenance and review confidence without inventing evidence", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase3-prompts-"));
  try {
    const root = initializeProject(parent, { projectName: "Phase Three", projectType: "standalone", profile: "thriller" });
    const prompt = bookPlanPrompt(root);
    assert.match(prompt, /taste-and-voice/);
    assert.match(prompt, /story-world/);
    assert.match(prompt, /human-authenticity/);
    assert.match(prompt, /reader-and-market/);
    assert.match(prompt, /discard reviewer names, handles, and profile URLs/i);
    assert.match(prompt, /ratings 1–2 as negative, 3 as mixed, and 4–5 as positive/i);
    assert.match(prompt, /One-star-only evidence can never exceed moderate/i);
    assert.match(prompt, /positive counterweights/i);
    assert.match(prompt, /prevent, mitigate, accept-as-tradeoff, or irrelevant-to-project/i);
    assert.match(prompt, /never invent public-review evidence/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("draft preparation requires ready research items and preserves legacy compatibility", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase3-queue-"));
  try {
    const root = initializeProject(parent, { projectName: "Queue", projectType: "standalone", profile: "romantasy" });
    const prompt = queuePrompt(root);
    assert.match(prompt, /ready RES-NNN/i);
    assert.match(prompt, /legacy advisories/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("review and reader workflows keep public observations separate from manuscript reader evidence", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase3-separation-"));
  try {
    const root = initializeProject(parent, { projectName: "Separation", projectType: "standalone", profile: "thriller" });
    assert.match(reviewPrompt(root, "manuscript"), /market-friction evidence only/i);
    assert.match(reviewPrompt(root, "manuscript"), /never to change reader metrics/i);
    assert.match(readerTestPrompt(root, "prepare"), /must never.*import public-review observations/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
