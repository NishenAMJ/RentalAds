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
