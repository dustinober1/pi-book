# Novel Forge 1.3 Phase 5 Recalibration and Scene-Audit Follow-up Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development task by task.

**Goal:** Expose the already-supported recalibration audit through `/novel-review recalibration` and prevent false-positive state-neutral conversation findings when character, relationship, or pressure state changes.

**Architecture:** Keep the merged Phase 5 audit services and transactional event flow. Extend authorization and the Pi command adapter so recalibration invokes the existing `research-update` + `scope: recalibration` path with the current voice-audit artifact, and refine the pure scene-audit predicate to evaluate the complete packet/plot state vector.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, Node test runner, existing Novel Forge events and GitHub Actions matrix.

## Global constraints

- Version remains `1.3.0`; no release tag.
- No new event type, top-level stage, dependency, hosted service, or browser workflow.
- Recalibration remains state-neutral and may write only `voice-audits.yaml` through `research-update`.
- Recalibration must refuse clearly when there is no approved voice baseline or no manuscript sample.
- The command must preserve stage, gates, book state, and manuscript bytes.
- A conversational scene is state-neutral only when plot, pressure, character, and relationship movement are all neutral.
- Existing scene-audit and command behavior remains compatible.
- Use TDD and merge only an exact GitHub-Actions-tested SHA.

---

### Task 1: Scene-state false-positive regression

**Files:**
- Modify: `tests/scene-engine.test.ts`
- Modify: `src/application/scene-audit.ts`

- [ ] Add failing tests proving an unchanged plot state is not flagged when relationship, character, or pressure state changes.
- [ ] Add coverage for `briefing` and `interrogation` as conversational engines.
- [ ] Confirm a scene with all four state channels neutral is still flagged.
- [ ] Implement the minimum full-state-vector predicate.
- [ ] Commit `fix: use full state vector for conversation audits`.

### Task 2: Explicit recalibration command

**Files:**
- Modify: `src/application/authorization.ts`
- Modify: `src/pi/extension.ts`
- Modify: `tests/commands.test.ts`
- Create: `tests/recalibration-command.test.ts`

- [ ] Add failing tests for recalibration authorization in drafting, act review, revision, manuscript review, and packaging, with planning stages refused.
- [ ] Add failing command tests proving `/novel-review` completions include `recalibration`.
- [ ] Add integration tests proving the command appends one recalibration voice audit and preserves stage, gates, book state, and manuscript bytes.
- [ ] Add refusal tests for missing approved baseline and empty manuscript.
- [ ] Implement the command using the existing `research-update` event with `scope: recalibration` and the current `voice-audits.yaml` content.
- [ ] Commit `feat: expose explicit voice recalibration`.

### Task 3: Documentation and verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `RELEASE.md`

- [ ] Document `/novel-review recalibration` and the full state-vector conversation rule.
- [ ] Resolve actionable review threads.
- [ ] Run on Node 22.19.0 and Node 24:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

- [ ] Mark ready and merge only the tested SHA.
