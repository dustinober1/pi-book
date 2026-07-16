import test from "node:test";
import assert from "node:assert/strict";
import { bookPlanFindings } from "../src/application/book-strategy.js";
import { completePlot, completeStrategy, queueFixture } from "./phase4-fixtures.js";

test("decision entries link to valid planned chapters", () => {
  const plot = completePlot();
  plot.decisions![0]!.chapter = 99;
  assert.ok(bookPlanFindings({ strategy: completeStrategy(), plot, queue: queueFixture() }).some((item) => item.code === "invalid-decision-chapter"));
});

test("decision entries require complete consequences and a forward payoff", () => {
  const plot = completePlot();
  plot.decisions![0]!.deferred_cost = "";
  plot.decisions![0]!.payoff_window = { start_chapter: 1, end_chapter: 1 };
  const codes = bookPlanFindings({ strategy: completeStrategy(), plot, queue: queueFixture() }).map((item) => item.code);
  assert.ok(codes.includes("incomplete-decision-consequence"));
  assert.ok(codes.includes("invalid-payoff-window"));
});

test("payoffs require an earlier setup", () => {
  const plot = completePlot();
  plot.chapters[0]!.payoff_ids = ["ST-UNSEEDED"];
  assert.ok(bookPlanFindings({ strategy: completeStrategy(), plot, queue: queueFixture() }).some((item) => item.code === "payoff-before-setup"));
});

test("three consecutive identical scene engines block the plan", () => {
  const queue = queueFixture();
  for (const item of queue.packets.slice(0, 3)) item.scene_engine = "interview";
  assert.ok(bookPlanFindings({ strategy: completeStrategy(), plot: completePlot(), queue }).some((item) => item.code === "middle-scene-repetition"));
});
