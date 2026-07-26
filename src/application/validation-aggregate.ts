/**
 * Novel Forge validates a submitted event in layers: required output files, YAML
 * and schema shape, profile packet fields, cross-artifact references, and domain
 * integrity. Throwing at the first failing layer forces an author agent to
 * discover the contract one rejection at a time, which burns the single
 * permitted retry and discards an otherwise complete proposal.
 *
 * The aggregator runs each independent validation step, records every problem,
 * and raises one rejection describing all of them.
 */

function problemText(error: unknown): string {
  if (error instanceof Error) return error.message.trim() || "Novel Forge rejected the event for an unknown reason.";
  if (typeof error === "string" && error.trim()) return error.trim();
  return "Novel Forge rejected the event for an unknown reason.";
}

export function aggregateRejectionMessage(problems: string[]): string {
  const unique = [...new Set(problems.map((item) => item.trim()).filter(Boolean))];
  if (unique.length === 1) return unique[0] as string;
  const numbered = unique.map((item, index) => `${index + 1}. ${item}`).join("\n\n");
  return [
    `${unique.length} validation problems must all be fixed before this event can apply.`,
    "Resubmit the complete required file set for this event with every problem below corrected.",
    "",
    numbered,
  ].join("\n");
}

export class ValidationAggregator {
  private readonly problems: string[] = [];

  /**
   * Runs one validation step. A step that throws records its problem and yields
   * `undefined` so later independent steps still run; dependent steps should
   * check for `undefined` and skip rather than cascade a duplicate failure.
   */
  run<T>(step: () => T): T | undefined {
    try {
      return step();
    } catch (error) {
      this.problems.push(problemText(error));
      return undefined;
    }
  }

  add(message: string): void {
    const text = message.trim();
    if (text) this.problems.push(text);
  }

  get failed(): boolean {
    return this.problems.length > 0;
  }

  get collected(): string[] {
    return [...new Set(this.problems)];
  }

  throwIfAny(): void {
    if (!this.problems.length) return;
    throw new Error(aggregateRejectionMessage(this.problems));
  }
}
