/**
 * Owner-level shared projects aggregate team hours in reports.
 * When includeTeamEarnings is false, only the current user's billable hours count.
 */
export function canIncludeTeamEarnings(projects) {
  return (projects ?? []).some(
    (p) => p.is_shared && Array.isArray(p.members) && p.members.length > 0,
  );
}

export function computeBillableTotals(projects, userName, includeTeamEarnings) {
  let totalBillableHours = 0;
  let totalBillableAmount = 0;

  for (const project of projects ?? []) {
    const rate = Number(project.hourlyRate ?? 0);
    const usePersonalOnly =
      !includeTeamEarnings &&
      project.is_shared &&
      Array.isArray(project.members) &&
      project.members.length > 0;

    if (usePersonalOnly) {
      const ownMember = project.members.find((m) => m.user_name === userName);
      const hours = Number(ownMember?.billableHours ?? 0);
      totalBillableHours += hours;
      totalBillableAmount += hours * rate;
    } else {
      const hours = Number(project.billableHours ?? 0);
      const amount = Number(
        project.billableAmount ?? hours * (project.hourlyRate ?? 0),
      );
      totalBillableHours += hours;
      totalBillableAmount += amount;
    }
  }

  return { totalBillableHours, totalBillableAmount };
}
