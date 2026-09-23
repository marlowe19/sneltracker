import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBreakToGross,
  applyProjectDefaultBreakOnStop,
  clearBreakFromGross,
  computeBreakMs,
  computeGrossDurationMs,
  preserveBreakOnGross,
  resolveProjectBreakMinutes,
  formatBreakDeductionSubtext,
} from "../lib/breakDeduction.js";

test("resolveProjectBreakMinutes uses 30 when project setting is null", () => {
  assert.equal(resolveProjectBreakMinutes(null), 30);
  assert.equal(resolveProjectBreakMinutes({ default_break_minutes: null }), 30);
  assert.equal(resolveProjectBreakMinutes({ default_break_minutes: 45 }), 45);
});

test("computeBreakMs caps at gross duration", () => {
  const grossMs = 20 * 60 * 1000;
  assert.equal(computeBreakMs(30, grossMs), grossMs);
  assert.equal(computeBreakMs(15, grossMs), 15 * 60 * 1000);
});

test("applyBreakToGross stores net duration and break metadata", () => {
  const grossMs = 9 * 60 * 60 * 1000;
  const result = applyBreakToGross(grossMs, 30);
  assert.equal(result.break_deduction_ms, 30 * 60 * 1000);
  assert.equal(result.duration_ms, grossMs - 30 * 60 * 1000);
});

test("preserveBreakOnGross keeps break when end time changes", () => {
  const newGrossMs = 8.5 * 60 * 60 * 1000;
  const result = preserveBreakOnGross(newGrossMs, 30 * 60 * 1000);
  assert.equal(result.break_deduction_ms, 30 * 60 * 1000);
  assert.equal(result.duration_ms, newGrossMs - 30 * 60 * 1000);
});

test("clearBreakFromGross restores gross duration", () => {
  const grossMs = 9 * 60 * 60 * 1000;
  const result = clearBreakFromGross(grossMs);
  assert.equal(result.break_deduction_ms, null);
  assert.equal(result.duration_ms, grossMs);
});

test("computeGrossDurationMs from timestamps", () => {
  const start = "2026-06-29T08:00:00.000Z";
  const end = "2026-06-29T17:00:00.000Z";
  assert.equal(computeGrossDurationMs(start, end), 9 * 60 * 60 * 1000);
});

test("applyProjectDefaultBreakOnStop deducts when project default enabled", () => {
  const grossMs = 9 * 60 * 60 * 1000;
  const result = applyProjectDefaultBreakOnStop(grossMs, {
    default_break_enabled: true,
    default_break_minutes: 30,
  });
  assert.equal(result.break_deduction_ms, 30 * 60 * 1000);
  assert.equal(result.duration_ms, grossMs - 30 * 60 * 1000);
});

test("applyProjectDefaultBreakOnStop skips when project default disabled", () => {
  const grossMs = 9 * 60 * 60 * 1000;
  const result = applyProjectDefaultBreakOnStop(grossMs, {
    default_break_enabled: false,
    default_break_minutes: 30,
  });
  assert.equal(result.break_deduction_ms, null);
  assert.equal(result.duration_ms, grossMs);
});

test("applyProjectDefaultBreakOnStop skips without project settings", () => {
  const grossMs = 9 * 60 * 60 * 1000;
  const result = applyProjectDefaultBreakOnStop(grossMs, null);
  assert.equal(result.break_deduction_ms, null);
  assert.equal(result.duration_ms, grossMs);
});

test("formatBreakDeductionSubtext explains total vs break", () => {
  const grossMs = 9 * 60 * 60 * 1000;
  assert.equal(
    formatBreakDeductionSubtext(grossMs, 30 * 60 * 1000),
    "Van 9u totaal is 30 min pauze afgetrokken"
  );
});
