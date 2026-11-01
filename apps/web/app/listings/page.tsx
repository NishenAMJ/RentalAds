"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/pagination";

import type { PublicListing } from "@/lib/listings";
import { ListingCard } from "@/components/listing-card";
import { ListingFilters, cleanFilters } from "@/components/listing-filters";
import { ActionLink, EmptyState, SkeletonCards, PrivacyNote } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";

export default function ListingsPage() {
  return <Suspense fallback={<SkeletonCards label="Loading homes" />}><ListingsContent /></Suspense>;
}

function ListingsContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const applied = cleanFilters(searchParams);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">{t("listings.eyebrow")}</p>
      <h1>{t("listings.title")}</h1>
      <p className="intro">
        {t("listings.intro")}
      </p></div></div>
      <ListingFilters applied={applied} />
      {/* Remounting on filter change resets the page number and loading state. */}
      <ListingResults key={`${applied.toString()}-${page}`} filters={applied.toString()} initialPage={page} />
    </section>
  );
}

function ListingResults({ filters, initialPage }: { filters: string; initialPage: number }) {
  const t = useT();
  const router = useRouter();
  const pager = usePaginated<PublicListing>("/listings", false, filters, initialPage);
  const { items: listings, error, loading } = pager;
  const filtered = filters !== "";
  return (
    <>
      <div className="browse-invitation"><PrivacyNote>{t("listings.invite")}</PrivacyNote><ActionLink href="/renter/new">{t("nav.find")}</ActionLink></div>
      {!loading && !error && <p className="count-chip" role="status">{t("listings.showing", { count: listings.length })}{filtered ? t("listings.filtered") : ""}</p>}
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : loading ? (
        <SkeletonCards label="Loading homes" />
      ) : listings.length === 0 ? (
        <EmptyState
          title={pager.page > 1 ? t("listings.empty.more") : filtered ? t("listings.empty.filtered") : t("listings.empty.title")}
          description={filtered ? t("listings.empty.filteredHelp") : t("listings.empty.help")}
          action={filtered ? <button type="button" className="ui-button ui-button-ghost" onClick={() => router.replace("/listings", { scroll: false })}>Clear filters</button> : <ActionLink href="/renter/new">{t("listings.empty.cta")}</ActionLink>} />
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
      {error && <button onClick={pager.retry}>Retry</button>}
      <Pagination {...pager} onPageChange={(nextPage) => {
        const params = new URLSearchParams(filters);
        if (nextPage > 1) params.set("page", String(nextPage));
        router.replace(params.size ? `/listings?${params}` : "/listings", { scroll: false });
      }} />
    </>
  );
}
