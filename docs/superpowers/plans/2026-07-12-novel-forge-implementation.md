# Novel Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Genesis for Pi with a compact, typed, series-capable novel engine supporting thriller and romantasy profiles.

**Architecture:** Build a TypeScript domain/application core, profile layer, context builder, transactional project store, review engine, migration adapter, and thin Pi extension. Use one workflow definition and a compact set of durable project files.

**Tech Stack:** Node.js 24, TypeScript, TypeBox, YAML, Pi extension API, Node test runner.

## Global Constraints

- Expose eight normal commands plus one temporary administrative migration command.
- Keep one shared engine for thriller and romantasy.
- Preserve author-specific voice and avoid detector-evasion objectives.
- Keep locked canon separate from provisional plans.
- Use one workflow-event commit rather than one-file commits.
- Preserve existing manuscripts during migration.

---

### Task 1: Package and schemas
- [x] Replace package metadata and add TypeScript/YAML dependencies.
- [x] Define versioned project, book, canon, thread, plot, queue, ticket, and genre schemas.
- [x] Add one canonical workflow definition.

### Task 2: Profiles
- [x] Implement a shared profile interface.
- [x] Implement thriller planning, packet, gate, and review rules.
- [x] Implement romantasy planning, packet, gate, and review rules.

### Task 3: Project store
- [x] Implement project discovery and validated YAML reads.
- [x] Implement rollback-capable multi-file transactions.
- [x] Implement coherent Git checkpoints.
- [x] Implement compact project initialization.

### Task 4: Context and prompts
- [x] Build reference-filtered chapter context.
- [x] Add bounded voice and previous-chapter excerpts.
- [x] Add shared and profile-aware prompts.

### Task 5: Application and commands
- [x] Implement start, status, plan, run, draft, review, revise, and package services.
- [x] Register the eight public Pi commands.
- [x] Add administrative migration.

### Task 6: Review and scanners
- [x] Implement evidence-backed review/ticket helpers.
- [x] Retain seven deterministic scanner entry points.
- [x] Add targeted regression rules.

### Task 7: Migration
- [x] Preserve Genesis control files under legacy storage.
- [x] Consolidate voice and project artifacts.
- [x] Preserve chapter files and produce a migration report.

### Task 8: Verification
- [x] Add schema, profile, transaction, context, command, migration, and end-to-end tests.
- [x] Add type checking and CI.
- [x] Verify package contents with `npm pack --dry-run`.
