import { Type, type Static } from "@sinclair/typebox";
import type { BudgetExhaustionPolicy, QualityTierId } from "../domain/quality-profile.js";

const QualityTierSchema = Type.Union([
  Type.Literal("economy"), Type.Literal("balanced"), Type.Literal("premium"), Type.Literal("editorial"),
]);

export const BudgetReservationSchema = Type.Object({
  reservationId: Type.String({ minLength: 1 }),
  runId: Type.String({ minLength: 1 }),
  callId: Type.String({ minLength: 1 }),
  chapter: Type.Integer({ minimum: 1 }),
  tier: QualityTierSchema,
  minimumTokens: Type.Integer({ minimum: 1 }),
  createdAt: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type BudgetReservation = Static<typeof BudgetReservationSchema>;

export const BudgetSettledCallSchema = Type.Object({
  runId: Type.String({ minLength: 1 }),
  callId: Type.String({ minLength: 1 }),
  chapter: Type.Integer({ minimum: 1 }),
  tier: QualityTierSchema,
  tokens: Type.Integer({ minimum: 0 }),
  estimated: Type.Boolean(),
  settledAt: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type BudgetSettledCall = Static<typeof BudgetSettledCallSchema>;

export const BudgetLedgerEventSchema = Type.Object({
  type: Type.Union([Type.Literal("stop"), Type.Literal("downgrade")]),
  runId: Type.String({ minLength: 1 }),
  callId: Type.String({ minLength: 1 }),
  chapter: Type.Integer({ minimum: 1 }),
  reason: Type.Union([Type.Literal("total-token-limit"), Type.Literal("chapter-token-limit"), Type.Literal("chapter-call-limit")]),
  fromTier: QualityTierSchema,
  toTier: Type.Optional(QualityTierSchema),
  at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type BudgetLedgerEvent = Static<typeof BudgetLedgerEventSchema>;

export const BudgetLedgerSchema = Type.Object({
  schemaVersion: Type.Literal("1.0.0"),
  reservations: Type.Array(BudgetReservationSchema),
  settledCalls: Type.Array(BudgetSettledCallSchema),
  events: Type.Array(BudgetLedgerEventSchema),
  updatedAt: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type BudgetLedger = Static<typeof BudgetLedgerSchema>;

export interface BudgetLimits {
  maximumTotalTokens: number | null;
  maximumTokensPerChapter: number | null;
  maximumCallsPerChapter: number | null;
  onExhaustion: BudgetExhaustionPolicy;
}

export type BudgetBoundaryReason = BudgetLedgerEvent["reason"];

export type BudgetReservationResult =
  | { action: "reserved"; reservation: BudgetReservation }
  | { action: "stop"; reason: BudgetBoundaryReason; tier: QualityTierId }
  | { action: "downgrade"; reason: BudgetBoundaryReason; fromTier: QualityTierId; toTier: QualityTierId };

export function emptyBudgetLedger(now = new Date().toISOString()): BudgetLedger {
  return { schemaVersion: "1.0.0", reservations: [], settledCalls: [], events: [], updatedAt: now };
}

export function nextLowerQualityTier(tier: QualityTierId): QualityTierId | null {
  if (tier === "editorial") return "premium";
  if (tier === "premium") return "balanced";
  if (tier === "balanced") return "economy";
  return null;
}

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer.`);
  return value;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function clone(ledger: BudgetLedger): BudgetLedger {
  return structuredClone(ledger);
}

function activeTokens(ledger: BudgetLedger): number {
  return ledger.reservations.reduce((total, item) => total + item.minimumTokens, 0);
}

function settledTokens(ledger: BudgetLedger): number {
  return ledger.settledCalls.reduce((total, item) => total + item.tokens, 0);
}

function chapterReservedTokens(ledger: BudgetLedger, chapter: number): number {
  return ledger.reservations.filter((item) => item.chapter === chapter).reduce((total, item) => total + item.minimumTokens, 0);
}

function chapterSettledTokens(ledger: BudgetLedger, chapter: number): number {
  return ledger.settledCalls.filter((item) => item.chapter === chapter).reduce((total, item) => total + item.tokens, 0);
}

function chapterCalls(ledger: BudgetLedger, chapter: number): number {
  return ledger.reservations.filter((item) => item.chapter === chapter).length
    + ledger.settledCalls.filter((item) => item.chapter === chapter).length;
}

function exhaustedResult(input: ReserveBudgetInput, reason: BudgetBoundaryReason): { ledger: BudgetLedger; result: BudgetReservationResult } {
  const updated = clone(input.ledger);
  const lower = input.limits.onExhaustion === "downgrade" ? nextLowerQualityTier(input.tier) : null;
  const event: BudgetLedgerEvent = {
    type: lower ? "downgrade" : "stop",
    runId: input.runId,
    callId: input.callId,
    chapter: input.chapter,
    reason,
    fromTier: input.tier,
    ...(lower ? { toTier: lower } : {}),
    at: input.createdAt,
  };
  updated.events.push(event);
  updated.updatedAt = input.createdAt;
  return lower
    ? { ledger: updated, result: { action: "downgrade", reason, fromTier: input.tier, toTier: lower } }
    : { ledger: updated, result: { action: "stop", reason, tier: input.tier } };
}

export interface ReserveBudgetInput {
  ledger: BudgetLedger;
  reservationId: string;
  runId: string;
  callId: string;
  chapter: number;
  tier: QualityTierId;
  minimumTokens: number;
  limits: BudgetLimits;
  createdAt: string;
}

export function reserveBudget(
  ledger: BudgetLedger,
  input: Omit<ReserveBudgetInput, "ledger">,
): { ledger: BudgetLedger; result: BudgetReservationResult } {
  const full: ReserveBudgetInput = { ledger, ...input };
  positiveInteger(input.chapter, "Budget chapter");
  positiveInteger(input.minimumTokens, "Minimum reservation tokens");
  if (!input.reservationId.trim() || !input.runId.trim() || !input.callId.trim() || !input.createdAt.trim()) throw new Error("Budget reservation identifiers and timestamp are required.");
  if (ledger.reservations.some((item) => item.reservationId === input.reservationId || item.callId === input.callId)
    || ledger.settledCalls.some((item) => item.runId === input.runId && item.callId === input.callId)) {
    throw new Error(`Budget call ${input.callId} is already recorded.`);
  }

  const totalAfter = settledTokens(ledger) + activeTokens(ledger) + input.minimumTokens;
  if (input.limits.maximumTotalTokens !== null && totalAfter > input.limits.maximumTotalTokens) {
    return exhaustedResult(full, "total-token-limit");
  }
  const chapterAfter = chapterSettledTokens(ledger, input.chapter) + chapterReservedTokens(ledger, input.chapter) + input.minimumTokens;
  if (input.limits.maximumTokensPerChapter !== null && chapterAfter > input.limits.maximumTokensPerChapter) {
    return exhaustedResult(full, "chapter-token-limit");
  }
  const callsAfter = chapterCalls(ledger, input.chapter) + 1;
  if (input.limits.maximumCallsPerChapter !== null && callsAfter > input.limits.maximumCallsPerChapter) {
    return exhaustedResult(full, "chapter-call-limit");
  }

  const reservation: BudgetReservation = {
    reservationId: input.reservationId,
    runId: input.runId,
    callId: input.callId,
    chapter: input.chapter,
    tier: input.tier,
    minimumTokens: input.minimumTokens,
    createdAt: input.createdAt,
  };
  const updated = clone(ledger);
  updated.reservations.push(reservation);
  updated.updatedAt = input.createdAt;
  return { ledger: updated, result: { action: "reserved", reservation } };
}

export interface SettleBudgetInput {
  runId: string;
  callId: string;
  chapter: number;
  tier: QualityTierId;
  actualTokens: number;
  estimated: boolean;
  settledAt: string;
}

export function settleBudgetReservation(ledger: BudgetLedger, reservationId: string, input: SettleBudgetInput): BudgetLedger {
  const index = ledger.reservations.findIndex((item) => item.reservationId === reservationId);
  if (index < 0) throw new Error(`Budget reservation ${reservationId} does not exist.`);
  const reservation = ledger.reservations[index]!;
  if (reservation.runId !== input.runId || reservation.callId !== input.callId || reservation.chapter !== input.chapter) {
    throw new Error(`Budget reservation ${reservationId} does not match the settled call.`);
  }
  nonnegativeInteger(input.actualTokens, "Actual tokens");
  if (!input.settledAt.trim()) throw new Error("Settlement timestamp is required.");
  const updated = clone(ledger);
  updated.reservations.splice(index, 1);
  updated.settledCalls.push({
    runId: input.runId,
    callId: input.callId,
    chapter: input.chapter,
    tier: input.tier,
    tokens: input.actualTokens,
    estimated: input.estimated,
    settledAt: input.settledAt,
  });
  updated.updatedAt = input.settledAt;
  return updated;
}

export function releaseBudgetReservation(ledger: BudgetLedger, reservationId: string, releasedAt = new Date().toISOString()): BudgetLedger {
  const index = ledger.reservations.findIndex((item) => item.reservationId === reservationId);
  if (index < 0) return ledger;
  const updated = clone(ledger);
  updated.reservations.splice(index, 1);
  updated.updatedAt = releasedAt;
  return updated;
}

export function budgetLedgerUsage(ledger: BudgetLedger): {
  totalTokens: number;
  activeReservedTokens: number;
  settledCalls: number;
  activeReservations: number;
} {
  return {
    totalTokens: settledTokens(ledger),
    activeReservedTokens: activeTokens(ledger),
    settledCalls: ledger.settledCalls.length,
    activeReservations: ledger.reservations.length,
  };
}
