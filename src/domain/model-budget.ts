export interface ModelBudgetEnvelope {
  maxInstructionChars: number;
  maxEvidenceChars: number;
  reservedOutputTokens: number;
  safetyMarginTokens: number;
}

export interface ResolvedModelBudget extends ModelBudgetEnvelope {
  modelContextTokens: number | null;
  estimatedInstructionTokens: number;
  maximumEvidenceTokens: number;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer.`);
  return value;
}

export function resolveModelBudget(
  envelope: ModelBudgetEnvelope,
  instructionChars: number,
  modelContextTokens?: number,
): ResolvedModelBudget {
  const maxInstructionChars = positiveInteger(envelope.maxInstructionChars, "Instruction character budget");
  const maxEvidenceChars = nonnegativeInteger(envelope.maxEvidenceChars, "Evidence character budget");
  const reservedOutputTokens = positiveInteger(envelope.reservedOutputTokens, "Reserved output tokens");
  const safetyMarginTokens = nonnegativeInteger(envelope.safetyMarginTokens, "Safety margin tokens");
  const normalizedInstructionChars = nonnegativeInteger(instructionChars, "Instruction characters");
  if (normalizedInstructionChars > maxInstructionChars) {
    throw new Error(`Instruction budget exceeded before evidence was attached: actual=${normalizedInstructionChars}, maximum=${maxInstructionChars}.`);
  }

  const estimatedInstructionTokens = Math.ceil(normalizedInstructionChars / 4);
  const configuredEvidenceTokens = Math.floor(maxEvidenceChars / 4);
  let maximumEvidenceTokens = configuredEvidenceTokens;
  let normalizedModelContextTokens: number | null = null;

  if (modelContextTokens !== undefined) {
    normalizedModelContextTokens = positiveInteger(modelContextTokens, "Model context tokens");
    const remainingModelTokens = normalizedModelContextTokens
      - estimatedInstructionTokens
      - reservedOutputTokens
      - safetyMarginTokens;
    if (remainingModelTokens < 0) {
      throw new Error("Model context cannot fit instructions, reserved output, and safety margin.");
    }
    maximumEvidenceTokens = Math.min(configuredEvidenceTokens, remainingModelTokens);
  }

  return {
    maxInstructionChars,
    maxEvidenceChars,
    reservedOutputTokens,
    safetyMarginTokens,
    modelContextTokens: normalizedModelContextTokens,
    estimatedInstructionTokens,
    maximumEvidenceTokens,
  };
}
