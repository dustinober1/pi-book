/**
 * Absolute reference bands for style-pattern metrics.
 *
 * Every style-pattern rule was originally relative: it compared a scope either to
 * an accepted author baseline or to the rest of the corpus. Both comparisons go
 * quiet on a manuscript that is uniformly AI-flavored, because nothing stands out
 * against anything else. These bands give the rules a fixed reference so a
 * consistent tell is still a finding, and so a single chapter can be linted at all
 * (the corpus-concentration fallback needs several documents to mean anything).
 *
 * The numbers are calibration defaults for contemporary published fiction, chosen
 * to sit clear of ordinary stylistic range rather than at its edge — a finding
 * should mean "this is outside what published prose does", not "this is unusual".
 * They are review evidence, never authorship detection. A deliberate voice choice
 * can legitimately sit outside a band; that is what the review action is for.
 */

export interface ReferenceBand {
  /** Metric key as reported by extractVoiceMetrics / the rule's occurrence rate. */
  metric: string;
  /** Upper limit, for tells where more of the pattern is the problem. */
  ceiling?: number;
  /** Lower limit, for metrics where too little is the problem (cadence variance). */
  floor?: number;
  /** Human-readable unit, used in finding messages. */
  unit: string;
  /** What crossing the band suggests, phrased for a writer rather than a linter. */
  concern: string;
}

/**
 * A scope must reach this many words before absolute bands are evaluated. Rates
 * computed over less text are too noisy to compare against a fixed reference.
 * Set below a normal chapter target so per-chapter linting works.
 */
export const ABSOLUTE_BAND_MINIMUM_WORDS = 1_000;

export const REFERENCE_BANDS: Readonly<Record<string, ReferenceBand>> = {
  sentence_length_variance: {
    metric: "sentence_length_variance",
    floor: 35,
    unit: "variance in sentence word count",
    concern: "Sentence lengths are unusually uniform. Even cadence across a whole scope reads mechanical regardless of how good the individual sentences are.",
  },
  telling_emotion_rate_per_1000: {
    metric: "telling_emotion_rate_per_1000",
    ceiling: 2.5,
    unit: "telling-emotion words per 1,000 words",
    concern: "Emotion is being named rather than dramatised more often than published fiction does.",
  },
  ai_transition_rate_per_1000: {
    metric: "ai_transition_rate_per_1000",
    ceiling: 0.3,
    unit: "essayistic transitions per 1,000 words",
    concern: "Expository connectives and stock figures (“tapestry of”, “testament to”, “furthermore”) belong to argument, not narrative.",
  },
  negative_parallelism_rate_per_1000: {
    metric: "negative_parallelism_rate_per_1000",
    ceiling: 1.5,
    unit: "negative parallel constructions per 1,000 words",
    concern: "Paired negations (“not this, not that”) are a recognisable generated-prose cadence when they recur.",
  },
  not_x_but_y_rate_per_1000: {
    metric: "not_x_but_y_rate_per_1000",
    ceiling: 2,
    unit: "“not X but Y” constructions per 1,000 words",
    concern: "The corrective-definition frame is one of the most identifiable generated-prose habits.",
  },
  three_part_cadence_rate_per_1000: {
    metric: "three_part_cadence_rate_per_1000",
    ceiling: 3,
    unit: "three-part list cadences per 1,000 words",
    concern: "Tricolon used as a default rhythm rather than for emphasis flattens the prose.",
  },
  aphoristic_close_rate_per_1000: {
    metric: "aphoristic_close_rate_per_1000",
    ceiling: 6,
    unit: "short declarative paragraph closes per 1,000 words",
    concern: "Landing most paragraphs on a short profound-sounding beat is a strong generated-prose signature.",
  },
  rhetorical_question_ratio: {
    metric: "rhetorical_question_ratio",
    ceiling: 90,
    unit: "questions per 1,000 sentences",
    concern: "Questions used as interiority shorthand rather than as dramatic beats.",
  },
  fragment_ratio: {
    metric: "fragment_ratio",
    ceiling: 150,
    unit: "very short sentences per 1,000 sentences",
    concern: "Fragments used as a default intensity device lose their force.",
  },
  em_dash_rate_per_1000: {
    metric: "em_dash_rate_per_1000",
    ceiling: 6,
    unit: "em dashes per 1,000 words",
    concern: "Em-dash density is the single most commonly cited surface marker of generated prose.",
  },
  filter_word_rate_per_1000: {
    metric: "filter_word_rate_per_1000",
    ceiling: 9,
    unit: "filter words per 1,000 words",
    concern: "Perception verbs (saw, felt, heard, realised) put a layer of narration between the reader and the scene.",
  },
  body_language_repeat_rate_per_1000: {
    metric: "body_language_repeat_rate_per_1000",
    ceiling: 6,
    unit: "repeated body-language nouns per 1,000 words",
    concern: "A small rotating set of hands, eyes, jaw and breath standing in for characterisation.",
  },
  repeated_transition_rate_per_1000: {
    metric: "repeated_transition_rate_per_1000",
    ceiling: 2,
    unit: "uses of one paragraph-opening transition per 1,000 words",
    concern: "One connective carrying most paragraph transitions.",
  },
  repeated_ending_syntax_rate_per_1000: {
    metric: "repeated_ending_syntax_rate_per_1000",
    ceiling: 1,
    unit: "documents sharing one closing sentence shape per 1,000 words",
    concern: "Scenes and chapters closing on the same grammatical shape read as a template.",
  },
};

export interface BandBreach {
  kind: "above-ceiling" | "below-floor";
  limit: number;
  observed: number;
  band: ReferenceBand;
}

/** Returns the breach for a metric rate, or null when it sits inside the band. */
export function bandBreach(baselineKey: string, observed: number): BandBreach | null {
  const band = REFERENCE_BANDS[baselineKey];
  if (band === undefined || !Number.isFinite(observed)) return null;
  if (band.ceiling !== undefined && observed > band.ceiling) {
    return { kind: "above-ceiling", limit: band.ceiling, observed, band };
  }
  if (band.floor !== undefined && observed < band.floor) {
    return { kind: "below-floor", limit: band.floor, observed, band };
  }
  return null;
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

export function bandMessage(breach: BandBreach): string {
  const { band, observed, limit, kind } = breach;
  const comparison = kind === "above-ceiling"
    ? `${trim(observed)} ${band.unit}, above the published-fiction reference ceiling of ${trim(limit)}`
    : `${trim(observed)} ${band.unit}, below the published-fiction reference floor of ${trim(limit)}`;
  return `${comparison}. ${band.concern}`;
}
