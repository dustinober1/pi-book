export interface StageSpec {
  id: string;
  role: string;
  objective: string;
  must: readonly string[];
  avoid: readonly string[];
  inputs: readonly string[];
  outputs: readonly string[];
  validation: readonly string[];
  toolRules: readonly string[];
}
