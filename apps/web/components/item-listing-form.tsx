"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { DynamicFields, readAttributes } from "@/components/dynamic-fields";
import { PropertyPhotoPicker } from "@/components/property-photo-picker";
import { useT } from "@/components/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { categoryBySlug, categoryBlurbKey, categoryNameKey } from "@/lib/categories";
import type { ListingStatus } from "@/lib/admin-listings";
import type { RatePeriod } from "@/lib/items";
import { normalizeContactPhone, type PhotoUploadState } from "@/lib/listing-form";
import { useCategoryDefinitions } from "@/lib/use-categories";

/** Owner form for a vehicle, piece of equipment or event gear. Fields come from the API's category registry. */
export function ItemListingForm({ slug }: { slug: string }) {
  const t = useT();
  const category = categoryBySlug(slug);
  const definitions = useCategoryDefinitions();
  const [photos, setPhotos] = useState<PhotoUploadState>({ urls: [], uploading: false, failed: false });
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; status: ListingStatus } | null>(null);
  const alert = useRef<HTMLParagraphElement>(null);

  const definition = definitions?.find((candidate) => candidate.id === category?.id);
  if (!category?.item || (definitions && !definition)) return <p role="alert" className="notice error">{t("rent.new.closed")}</p>;
  if (!definition) return <p role="status">…</p>;

  function fail(message: string) {
    setError(message);
    requestAnimationFrame(() => alert.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !definition || !category) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const contact = normalizeContactPhone(phone);
    if (!contact) return fail(t("rent.book.phoneHelp"));
    if (photos.uploading || photos.failed) return fail("…");
    setBusy(true);
    setError("");
    try {
      const listing = await apiRequest<{ id: string; status: ListingStatus }>("/listings/items", {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({
          category: category.id,
          title: text("title"),
          ...(text("description") ? { description: text("description") } : {}),
          areaText: text("areaText"),
          rate: Number(text("rate")),
          ratePeriod: text("ratePeriod"),
          ...(text("depositAmount") ? { depositAmount: Number(text("depositAmount")) } : {}),
          attributes: readAttributes(definition, form),
          ownerContact: contact,
          photoUrls: photos.urls,
        }),
      });
      setCreated(listing);
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "");
    } finally {
      setBusy(false);
    }
  }

  if (created) return <div className="panel request-success" role="status">
    <h2>{t("rent.new.done.title")}</h2><p>{t("rent.new.done.body")}</p>
    <Link className="ui-button ui-button-primary" href="/owner/listings">{t("rent.new.done.cta")}</Link>
  </div>;

  return <section className="owner-new">
    <div className="page-heading"><div>
      <p className="eyebrow">{t("rent.new.eyebrow")} · {t(categoryNameKey(category.id))}</p>
      <h1>{t("rent.new.title")}</h1>
      <p className="intro">{t(categoryBlurbKey(category.id))} {t("rent.new.intro")}</p>
    </div></div>
    <form className="owner-form" onSubmit={submit} aria-busy={busy}>
      {error && <p ref={alert} tabIndex={-1} role="alert" className="notice error">{error}</p>}
      <fieldset className="panel form-grid two-columns" disabled={busy}>
        <label className="full-width">{t("rent.new.titleField")}<input name="title" minLength={3} maxLength={120} required /></label>
        <DynamicFields category={definition} disabled={busy} />
        <label className="full-width">{t("rent.new.description")}<textarea name="description" rows={4} maxLength={2000} /></label>
        <label className="full-width">{t("rent.new.area")}<input name="areaText" maxLength={300} required /></label>
        <label>{t("rent.new.rate")}<input name="rate" type="number" inputMode="numeric" min={1} max={2147483647} step={1} required /></label>
        <label>{t("rent.new.period")}
          <select name="ratePeriod" required defaultValue={definition.ratePeriods[0]}>
            {definition.ratePeriods.map((period: RatePeriod) => <option key={period} value={period}>{t(`rent.per.${period}`)}</option>)}
          </select></label>
        <label>{t("rent.new.deposit")}<input name="depositAmount" type="number" inputMode="numeric" min={0} max={2147483647} step={1} /></label>
        <label>{t("rent.book.phone")}
          <span className="phone-input"><span aria-hidden="true">+94</span>
            <input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="71 234 5678" value={phone} onChange={(event) => setPhone(event.target.value)} required /></span>
          <small>{t("rent.book.phoneHelp")}</small></label>
      </fieldset>
      <div className="panel"><h2 className="side-title">{t("rent.new.photos")}</h2><PropertyPhotoPicker onChange={setPhotos} disabled={busy} /></div>
      <div className="wizard-actions"><span /><button className="ui-button ui-button-primary" disabled={busy || photos.uploading}>{busy ? t("rent.book.busy") : t("rent.new.submit")}</button></div>
    </form>
  </section>;
}
