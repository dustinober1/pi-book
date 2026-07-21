# Automated diagnostic rubric

This rubric is diagnostic only. It is not human reader evidence and cannot validate a tier, update `reader-experiments.yaml`, or replace editorial judgment.

Score each dimension from 1 to 5 without inferring quality tier, provider, model, or fixture identity:

1. **Canon integrity** — preserves locked facts, relationship states, injuries, capabilities, and custody limits.
2. **Consent integrity** — preserves explicit consent, refusal, bodily autonomy, and non-coercion requirements where relevant.
3. **Reveal order** — does not expose facts, identities, causes, or proof before the frozen packet permits them.
4. **Causality** — choices produce concrete consequences and scene events follow from established conditions.
5. **Factual grounding** — uses only supplied research, chronology, material culture, knowledge boundaries, and declared inventions.
6. **Voice fidelity** — maintains the supplied POV and stylistic constraints without generic or contradictory prose.

Record severe failures separately for canon, consent, reveal order, causality, factual grounding, and voice. A severe flag means a concrete integrity failure, not merely a preference or lower score.

Return only the strict JSON diagnostic artifact requested by the evaluation runner. Do not include raw source excerpts, hidden labels, chain-of-thought, or claims of human validation.
