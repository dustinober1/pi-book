# Adaptive Context Distillation Baseline

Date: 2026-07-16

## Acceptance criteria

The final pull-request head must demonstrate all of the following on Node 22.19.0 and Node 24:

- deterministic section ordering and output for identical inputs;
- required sections retained in full or deterministic compact form;
- missing required record IDs fail before inference;
- optional sections omitted rather than silently truncating required records;
- complete privacy-safe section reports with source/rendered character counts and stable token estimates;
- cache keys isolated by project hash, relevant source hashes, runtime profile, distiller version, and section-policy version;
- exact cache hits reproduce identical context text;
- relevant source changes invalidate the cache;
- unrelated files do not invalidate the cache unless included in the relevant source set;
- corrupt cache entries are ignored and rebuilt;
- existing graph-blocking, voice originality, packet validation, research readiness, public-review exclusion, and writer-gate behavior remains unchanged.

## Evidence boundary

The benchmark and reports may contain section identifiers, record IDs, hashes, counts, statuses, and reasons. They must not contain raw prompts, manuscript prose, private research text, credentials, influence evidence, public-review bodies, or reader-response bodies.

Results will be added only after the exact final head passes the full repository gate set.
