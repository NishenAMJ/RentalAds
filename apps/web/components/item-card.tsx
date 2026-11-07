"use client";
import Link from "next/link";
import { PropertyImage } from "@/components/property-image";
import { useT } from "@/components/i18n-provider";
import { categoryById, categoryNameKey } from "@/lib/categories";
import { lkr, type ItemListing } from "@/lib/items";

/** A vehicle, tool or piece of event gear in a browse grid. */
export function ItemCard({ listing }: { listing: ItemListing }) {
  const t = useT();
  const category = categoryById(listing.category);
  const name = listing.title ?? listing.areaText;
  return <article className="listing-card">
    <Link href={`/item/${listing.id}`}>
      {listing.photoUrls[0]
        ? <PropertyImage className="property-photo" src={listing.photoUrls[0]} alt={name} width={640} height={420} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 400px" />
        : <div className="photo-placeholder">{t("rent.photoSoon")}</div>}
      <div className="card-body">
        {category && <p className="eyebrow">{t(categoryNameKey(category.id))}</p>}
        <h2>{name}</h2>
        <p className="card-facts">{listing.areaText}</p>
        <div className="card-footer">
          <p className="rent">{lkr(listing.monthlyRent)} <span>/ {t(`rent.per.${listing.ratePeriod}`)}</span></p>
          <span className="details-chip" aria-hidden="true">{t("rent.details")}</span>
        </div>
      </div>
    </Link>
  </article>;
}
