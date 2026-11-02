"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookingPanel } from "@/components/booking-panel";
import { PropertyImage } from "@/components/property-image";
import { ReportListingButton } from "@/components/ReportListingButton";
import { SkeletonCards } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { categoryById, categoryNameKey } from "@/lib/categories";
import { labelFor, lkr, type FieldDefinition, type ItemListing } from "@/lib/items";
import { useCategoryDefinitions } from "@/lib/use-categories";

/** Display text for one attribute value, using the category's own option labels. */
function attributeText(field: FieldDefinition, value: string | number | boolean, t: Parameters<typeof labelFor>[0]): string {
  if (typeof value === "boolean") return value ? t("rent.yes") : t("rent.no");
  const option = field.options?.find((candidate) => candidate.value === value);
  return option ? labelFor(t, option.labelKey) : String(value);
}

export function ItemDetail({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const definitions = useCategoryDefinitions();
  const [listing, setListing] = useState<ItemListing | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    let current = true;
    apiRequest<ItemListing>(`/listings/${encodeURIComponent(id)}`).then((data) => {
      if (!current) return;
      // Homes have their own page; an old link to one should not show an item layout.
      if (data.category === "PROPERTY") router.replace(`/property/${id}`);
      else setListing(data);
    }).catch((cause: unknown) => {
      if (current) setError(cause instanceof ApiError && cause.status === 404 ? t("rent.notFound") : cause instanceof Error ? cause.message : "");
    });
    return () => { current = false; };
  }, [id, router, t]);

  if (error) return <section><p role="alert" className="notice error">{error}</p><Link href="/categories">{t("nav.categories")}</Link></section>;
  if (!listing) return <SkeletonCards label="…" />;

  const category = categoryById(listing.category);
  const definition = definitions?.find((candidate) => candidate.id === listing.category);
  const photos = listing.photoUrls;
  const shown = photos[Math.min(active, Math.max(photos.length - 1, 0))];
  const name = listing.title ?? listing.areaText;
  const facts: [string, string][] = [
    ...(definition?.fields.flatMap((field): [string, string][] => {
      const value = listing.attributes?.[field.key];
      return value === undefined ? [] : [[labelFor(t, field.labelKey), attributeText(field, value, t)]];
    }) ?? []),
    [t("rent.new.area"), listing.areaText],
    ...(listing.depositAmount ? [[t("rent.deposit"), lkr(listing.depositAmount)] as [string, string]] : []),
  ];

  return <section className="property-page">
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {category && <Link href={category.browseHref}>{t(categoryNameKey(category.id))}</Link>}<span aria-hidden="true">/</span><span>{name}</span>
    </nav>
    <div className="property-layout">
      <div className="property-media">
        <div className="property-hero">
          {shown ? <PropertyImage className="property-photo" src={shown} alt={`${name}, ${Math.min(active, photos.length - 1) + 1}`} width={1200} height={720} sizes="(max-width: 1050px) 100vw, 760px" priority /> : <div className="photo-placeholder">{t("rent.photoSoon")}</div>}
          {photos.length > 1 && <span className="photo-count">{Math.min(active, photos.length - 1) + 1} / {photos.length}</span>}
        </div>
        {photos.length > 1 && <ul className="thumb-row">{photos.map((url, index) =>
          <li key={`${url}-${index}`}><button type="button" className="thumb" aria-label={`${index + 1}`} aria-current={index === active} onClick={() => setActive(index)}><PropertyImage src={url} alt="" width={240} height={150} sizes="160px" /></button></li>)}</ul>}
        {listing.description && <div className="panel"><p className="item-description">{listing.description}</p></div>}
      </div>
      <aside className="property-side">
        <div className="panel property-identity">
          <div className="identity-top">{category && <span className="ui-badge">{t(categoryNameKey(category.id))}</span>}{listing.reference && <span className="record-reference">{listing.reference}</span>}</div>
          <h1>{name}</h1>
          <p className="rent">{lkr(listing.monthlyRent)} <span>/ {t(`rent.per.${listing.ratePeriod}`)}</span></p>
        </div>
        <div className="panel"><dl className="glance">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {listing.mapLink && <a className="map-link" href={listing.mapLink} target="_blank" rel="noopener noreferrer">{t("rent.new.mapApproximate")} ↗</a>}</div>
        <BookingPanel listing={listing} />
        <div className="panel"><ReportListingButton key={listing.id} listingId={listing.id} /></div>
      </aside>
    </div>
  </section>;
}
