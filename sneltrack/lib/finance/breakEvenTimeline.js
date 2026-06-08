import { isHoliday } from "@/lib/holidays";
import { computeBreakEvenTimelineWithHolidayCheck } from "./breakEvenTimelineCore";

export { computeBreakEvenTimelineWithHolidayCheck } from "./breakEvenTimelineCore";

/**
 * Break-even timeline op basis van workload model (uren/week, uurtarief, feestdagen).
 */
export function computeBreakEvenTimeline(args) {
  return computeBreakEvenTimelineWithHolidayCheck(args, isHoliday);
}
