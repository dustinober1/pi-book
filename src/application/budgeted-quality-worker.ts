import {
  releaseBudgetReservation,
  reserveBudget,
  settleBudgetReservation,
  type BudgetBoundaryReason,
  type BudgetLimits,
  type BudgetReservationResult,
} from "./budget-ledger.js";
import type { QualityTierId } from "../domain/quality-profile.js";
import type {
  QualityModelCapacity,
  QualityModelSelection,
  QualityWorker,
  QualityWorkerRequest,
  QualityWorkerResult,
} from "../domain/quality-worker.js";
import { transactBudgetLedger } from "../infrastructure/budget-ledger-store.js";
import { appendRunBudgetEvent } from "../infrastructure/run-report-store.js";

export class QualityBudgetStopError extends Error {
  constructor(readonly reason: BudgetBoundaryReason, readonly tier: QualityTierId) {
    super(`Quality budget stopped ${tier} drafting at ${reason}.`);
    this.name = "QualityBudgetStopError";
  }
}

export class QualityBudgetDowngradeError extends Error {
  constructor(
    readonly reason: BudgetBoundaryReason,
    readonly fromTier: QualityTierId,
    readonly toTier: QualityTierId,
  ) {
    super(`Quality budget requires downgrade from ${fromTier} to ${toTier} at ${reason}.`);
    this.name = "QualityBudgetDowngradeError";
  }
}

export interface BudgetedQualityWorkerOptions {
  root: string;
  runId: string;
  chapter: number;
  tier: QualityTierId;
  limits: BudgetLimits;
  worker: QualityWorker;
  telemetryEnabled?: boolean;
  now?: () => string;
}

function reservedOutputTokens(request: QualityWorkerRequest): number {
  return request.pass === "candidate" || request.pass === "revision" ? 2_048 : 512;
}

export function minimumCallReservationTokens(request: QualityWorkerRequest): number {
  const input = Math.ceil((request.prompt.length + (request.context?.length ?? 0)) / 4);
  return Math.max(1, input + reservedOutputTokens(request));
}

function actualCallTokens(result: QualityWorkerResult): number {
  return (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);
}

export class BudgetedQualityWorker implements QualityWorker {
  readonly #options: BudgetedQualityWorkerOptions;

  constructor(options: BudgetedQualityWorkerOptions) {
    this.#options = options;
  }

  resolveModelCapacity(selection: QualityModelSelection, signal?: AbortSignal): Promise<QualityModelCapacity | null> {
    return this.#options.worker.resolveModelCapacity(selection, signal);
  }

  async run(request: QualityWorkerRequest, signal?: AbortSignal): Promise<QualityWorkerResult> {
    const reservationId = `RSV-${request.callId}`;
    const at = this.#options.now?.() ?? new Date().toISOString();
    const reserved = transactBudgetLedger<BudgetReservationResult>(this.#options.root, (ledger) => {
      const result = reserveBudget(ledger, {
        reservationId,
        runId: this.#options.runId,
        callId: request.callId,
        chapter: this.#options.chapter,
        tier: this.#options.tier,
        minimumTokens: minimumCallReservationTokens(request),
        limits: this.#options.limits,
        createdAt: at,
      });
      return { ledger: result.ledger, value: result.result };
    });
    if (!reserved.ok) throw new Error(reserved.message);
    if (reserved.value.action !== "reserved") {
      if (this.#options.telemetryEnabled !== false) {
        appendRunBudgetEvent(this.#options.root, this.#options.runId, {
          type: reserved.value.action,
          reason: reserved.value.reason,
          atCallId: request.callId,
        });
      }
      if (reserved.value.action === "downgrade") {
        throw new QualityBudgetDowngradeError(
          reserved.value.reason,
          reserved.value.fromTier,
          reserved.value.toTier,
        );
      }
      throw new QualityBudgetStopError(reserved.value.reason, reserved.value.tier);
    }

    try {
      const result = await this.#options.worker.run(request, signal);
      const settledAt = this.#options.now?.() ?? new Date().toISOString();
      const settlement = transactBudgetLedger(this.#options.root, (ledger) => ({
        ledger: settleBudgetReservation(ledger, reservationId, {
          runId: this.#options.runId,
          callId: request.callId,
          chapter: this.#options.chapter,
          tier: this.#options.tier,
          actualTokens: actualCallTokens(result),
          estimated: result.usage.estimated,
          settledAt,
        }),
        value: undefined,
      }));
      if (!settlement.ok) throw new Error(settlement.message);
      return result;
    } catch (error) {
      transactBudgetLedger(this.#options.root, (ledger) => ({
        ledger: releaseBudgetReservation(ledger, reservationId),
        value: undefined,
      }));
      throw error;
    }
  }
}
