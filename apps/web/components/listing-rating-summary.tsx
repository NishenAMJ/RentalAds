"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { apiRequest } from "@/lib/api-client";

type Ratings = { average: number | null; count: number };

export function ListingRatingSummary({ listingId }: { listingId: string }) {
  const t = useT();
  const [ratings, setRatings] = useState<Ratings | null>(null);
  useEffect(() => {
    let active = true;
    apiRequest<Ratings>(`/listings/${encodeURIComponent(listingId)}/ratings`)
      .then(value => { if (active) setRatings(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [listingId]);

  if (!ratings) return null;
  return <p className="small-copy" aria-label={ratings.count ? t("rent.rating.summary", { average: ratings.average ?? 0, count: ratings.count }) : t("rent.rating.none")}>
    {ratings.count && ratings.average !== null
      ? `★ ${t("rent.rating.summary", { average: ratings.average.toFixed(1), count: ratings.count })}`
      : t("rent.rating.none")}
  </p>;
}
