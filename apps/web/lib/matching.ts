export interface MatchCriterion {
  key: string;
  label: string;
  status: "matched" | "different" | "unspecified" | "unknown";
  detail: string;
}
export interface MatchAssessment {
  criteria: MatchCriterion[];
  areaMatched: boolean;
  requiresReview: boolean;
  matchPercentage: number;
  differences: string[];
}

/** How many criteria are in each state, for example "5 matched · 1 different". Used while a match card is collapsed. */
export function summariseCriteria(criteria: MatchCriterion[]): string {
  const count = (status: MatchCriterion["status"]) => criteria.filter((criterion) => criterion.status === status).length;
  const parts: [number, string][] = [
    [count("matched"), "matched"], [count("different"), "different"], [count("unknown"), "unverified"], [count("unspecified"), "not specified"],
  ];
  return parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(" · ");
}
