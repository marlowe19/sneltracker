import assert from "node:assert/strict";
import { computeBreakEvenTimelineWithHolidayCheck } from "../lib/finance/breakEvenTimelineCore.js";

function runTests() {
  const ref = new Date(2026, 5, 5); // 5 juni 2026

  // Al break-even: netto dekt privé kosten
  {
    const r = computeBreakEvenTimelineWithHolidayCheck(
      {
        businessCostsMonthly: 500,
        privateCostsMonthly: 800,
        taxReservePct: 35,
        earningsThisMonth: 3000,
        hourlyRateForecast: 55,
        weeklyHoursForecast: 40,
        referenceDate: ref,
      },
      () => false,
    );
    assert.equal(r.businessBreakEvenDate?.getDate(), 5);
    assert.equal(r.breakEvenDate?.getDate(), 5);
    assert.ok(r.projectedFreeToSpendEnd > 0);
  }

  // Zakelijke kosten eerder gedekt dan privé
  {
    const r = computeBreakEvenTimelineWithHolidayCheck(
      {
        businessCostsMonthly: 2000,
        privateCostsMonthly: 800,
        taxReservePct: 35,
        earningsThisMonth: 350,
        hourlyRateForecast: 55,
        weeklyHoursForecast: 40,
        referenceDate: ref,
      },
      () => false,
    );
    assert.ok(r.businessBreakEvenDate, "verwacht zakelijk break-even");
    assert.ok(r.breakEvenDate, "verwacht privé break-even");
    assert.ok(
      r.businessBreakEvenDate <= r.breakEvenDate,
      "zakelijk moet niet na privé komen",
    );
  }

  // Geen privé kosten: break-even wanneer netto >= 0
  {
    const r = computeBreakEvenTimelineWithHolidayCheck(
      {
        businessCostsMonthly: 0,
        privateCostsMonthly: 0,
        taxReservePct: 35,
        earningsThisMonth: 100,
        hourlyRateForecast: 55,
        weeklyHoursForecast: 40,
        referenceDate: ref,
      },
      () => false,
    );
    assert.equal(r.breakEvenDate?.getDate(), 5);
  }

  // Ongeldig uurtarief
  {
    const r = computeBreakEvenTimelineWithHolidayCheck(
      {
        businessCostsMonthly: 4000,
        privateCostsMonthly: 0,
        taxReservePct: 35,
        earningsThisMonth: 350,
        hourlyRateForecast: 0,
        weeklyHoursForecast: 40,
        referenceDate: ref,
      },
      () => false,
    );
    assert.equal(r.breakEvenDate, null);
    assert.equal(r.projectedEarningsEnd, null);
    assert.equal(r.projectedFreeToSpendEnd, null);
  }

  // Break-even later in de maand
  {
    const r = computeBreakEvenTimelineWithHolidayCheck(
      {
        businessCostsMonthly: 4000,
        privateCostsMonthly: 0,
        taxReservePct: 35,
        earningsThisMonth: 350,
        hourlyRateForecast: 55,
        weeklyHoursForecast: 40,
        referenceDate: ref,
      },
      () => false,
    );
    assert.ok(r.breakEvenDate, "verwacht break-even datum");
    assert.ok(r.breakEvenDate.getDate() > 5);
    assert.ok(r.breakEvenDate.getMonth() === 5);
    assert.ok(r.projectedEarningsEnd > 350);
  }

  // Feestdag vertraagt break-even
  {
    const noHoliday = computeBreakEvenTimelineWithHolidayCheck(
      {
        businessCostsMonthly: 2000,
        privateCostsMonthly: 500,
        taxReservePct: 35,
        earningsThisMonth: 0,
        hourlyRateForecast: 50,
        weeklyHoursForecast: 35,
        referenceDate: new Date(2026, 0, 1),
      },
      () => false,
    );
    const withHoliday = computeBreakEvenTimelineWithHolidayCheck(
      {
        businessCostsMonthly: 2000,
        privateCostsMonthly: 500,
        taxReservePct: 35,
        earningsThisMonth: 0,
        hourlyRateForecast: 50,
        weeklyHoursForecast: 35,
        referenceDate: new Date(2026, 0, 1),
      },
      (d) => d.getDate() === 2 && d.getMonth() === 0,
    );
    assert.ok(
      withHoliday.breakEvenDate >= noHoliday.breakEvenDate,
      "feestdag moet break-even niet vervroegen",
    );
  }

  console.log("breakEvenTimeline tests passed");
}

runTests();
