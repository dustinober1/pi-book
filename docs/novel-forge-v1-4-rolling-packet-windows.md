# Novel Forge 1.4 Rolling Packet Windows

## Purpose

Novel Forge now keeps only a small active set of chapter packets instead of carrying or rebuilding the whole book queue during drafting.

## Default policy

- Target: up to six ready packets.
- Refill threshold: fewer than two ready packets remain.
- Drafted, reviewed, and revised packets leave `chapter-queue.yaml`.
- Blocked and ready packets remain visible in the active window.
- When fewer than six planned chapters remain, Novel Forge refills only those chapters.

The policy is deterministic and genre profiles may override it in a future release without changing the active-window contract.

## Duplicate safety

Refill candidates come from the approved plot grid in chapter order. Novel Forge excludes:

- chapters with manuscript prose;
- chapters already present in the active queue;
- duplicate chapter numbers;
- chapters absent from the approved plot grid.

A guarded queue event rejects terminal packets, drafted chapters, duplicate packets, unplanned chapters, and more than six ready packets.

## Drafting flow

After a successful chapter draft, that packet is removed from the active queue. Drafting continues while at least two ready packets remain. When the window falls below two and undrafted planned chapters remain, the project moves to `chapter-queue` so Novel Forge can refill only the missing chapters.

Human gates and manuscript completion take precedence. A milestone gate still stops the workflow, and drafting reaches manuscript review when every planned chapter has manuscript prose.

## Persistent runs

A persistent `/novel-run` may cross a refill boundary. The run records deterministic event keys and does not replay completed chapters. Refill prompts remain bounded and do not grow with the full manuscript or full chapter plan.
