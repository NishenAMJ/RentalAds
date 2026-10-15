import type { MatchCriterion } from "@/lib/matching";

const statusLabels = {
  matched: "Matched",
  different: "Different",
  unspecified: "Not specified",
  unknown: "Unverified",
};
export function MatchCriteria({ criteria }: { criteria: MatchCriterion[] }) {
  return (
    <dl className="match-criteria">
      {criteria.map((criterion) => (
        <div
          key={criterion.key}
          className={`match-criterion match-criterion-${criterion.status}`}
        >
          <dt>
            <strong>{criterion.label}</strong>{" "}
            <span>{statusLabels[criterion.status]}</span>
          </dt>
          <dd>{criterion.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
