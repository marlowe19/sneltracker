// lib/logic/finance/earningsTotals.ts
// Ported 1:1 from sneltrack/lib/finance/earningsTotals.js
// Owner-level shared projects aggregate team hours in reports.
// When includeTeamEarnings is false, only the current user's billable hours count.

export interface ProjectMember {
  user_name: string;
  billableHours?: number;
}

export interface EarningsProject {
  is_shared?: boolean;
  hourlyRate?: number;
  members?: ProjectMember[];
  billableHours?: number;
  billableAmount?: number;
}

export function canIncludeTeamEarnings(projects: EarningsProject[] | null | undefined): boolean {
  return (projects ?? []).some(
    (p) => p.is_shared && Array.isArray(p.members) && p.members.length > 0
  );
}

export interface BillableTotals {
  totalBillableHours: number;
  totalBillableAmount: number;
}

export function computeBillableTotals(
  projects: EarningsProject[] | null | undefined,
  userName: string,
  includeTeamEarnings: boolean
): BillableTotals {
  let totalBillableHours = 0;
  let totalBillableAmount = 0;

  for (const project of projects ?? []) {
    const rate = Number(project.hourlyRate ?? 0);
    const usePersonalOnly =
      !includeTeamEarnings &&
      project.is_shared === true &&
      Array.isArray(project.members) &&
      project.members.length > 0;

    if (usePersonalOnly) {
      const ownMember = (project.members ?? []).find((m) => m.user_name === userName);
      const hours = Number(ownMember?.billableHours ?? 0);
      totalBillableHours += hours;
      totalBillableAmount += hours * rate;
    } else {
      const hours = Number(project.billableHours ?? 0);
      const amount = Number(project.billableAmount ?? hours * (project.hourlyRate ?? 0));
      totalBillableHours += hours;
      totalBillableAmount += amount;
    }
  }

  return { totalBillableHours, totalBillableAmount };
}
