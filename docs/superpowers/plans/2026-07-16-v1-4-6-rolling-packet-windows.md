# Novel Forge 1.4-6 — Rolling Chapter Packet Windows

## Goal

Keep drafting context bounded by maintaining a small active chapter-packet window that refills only when needed and never regenerates the whole book queue.

## Design

- `chapter-queue.yaml` represents only the active window, not drafted history.
- Drafted, reviewed, and revised packets leave the active queue.
- Default target is six ready packets.
- Refill begins only when fewer than two ready packets remain.
- If fewer than six undrafted planned chapters remain, refill only those chapters.
- Candidate chapters come from `plot-grid.yaml` in chapter order and exclude manuscript chapters and every chapter already in the active queue.
- Queue replacement rejects duplicate chapter numbers and packets for already drafted chapters.
- Drafting moves to `chapter-queue` only at the refill threshold, unless a human/milestone gate or manuscript completion takes precedence.
- Existing queues remain schema-readable; compaction occurs through guarded queue/draft events.
- Persistent runs may cross refill boundaries but still stop at human gates and never replay completed event keys.

## Implementation units

1. Add a pure packet-window policy and candidate service.
2. Compact terminal packets during draft events and switch stages only at the threshold.
3. Validate refill submissions and generate bounded refill prompts.
4. Add exact ten-chapter and prompt-growth evaluations.

## Verification

The final head must pass install, TypeScript, all tests, evaluations, release-tree verification, and package dry-run on Node 22.19.0 and Node 24 before merge.
