"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { BlockedDates } from "@/components/blocked-dates";
import { DynamicFields, readAttributes } from "@/components/dynamic-fields";
import { PropertyImage } from "@/components/property-image";
import { PropertyPhotoPicker } from "@/components/property-photo-picker";
import { useT } from "@/components/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { type CategoryDefinition } from "@/lib/items";
import { normalizeContactPhone, type PhotoUploadState } from "@/lib/listing-form";
import { isProperty, type OwnerListing } from "@/lib/listings";
import { useCategoryDefinitions } from "@/lib/use-categories";
import { ListingLocationPicker } from "@/components/listing-location-picker";
import type { LatLng } from "@/components/LocationPicker";

/** Local part of a stored +94 number, for the input that shows the prefix separately. */
const nationalNumber = (contact: string) => contact.replace(/^\+94/, "");
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Edits one of the owner's listings. Only what actually changed is sent, because anything renters read or see
 * (title, description, photos, area, details) sends a live listing back for review, while price and contact do not.
 */
export function ListingEdit({ id }: { id: string }) {
  const t = useT();
  const definitions = useCategoryDefinitions();
  const [listing, setListing] = useState<OwnerListing | null>(null);
  const [missing, setMissing] = useState(false);
  const [photos, setPhotos] = useState<PhotoUploadState>({ urls: [], uploading: false, failed: false });
  // Photos already on the listing that the owner has not removed; new uploads are added after them.
  const [kept, setKept] = useState<string[] | null>(null);
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [keyMoney, setKeyMoney] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<"" | "now" | "review">("");
  const alert = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    apiRequest<OwnerListing>(`/listings/mine/${encodeURIComponent(id)}`, { authenticated: true }).then((data) => {
      if (!active) return;
      setListing(data);
      setKept(data.photoUrls);
      setPhone(nationalNumber(data.ownerContact));
      setLocation(data.latitude != null && data.longitude != null
        ? { lat: Number(data.latitude), lng: Number(data.longitude) }
        : null);
      setKeyMoney(Boolean(data.keyMoney));
    }).catch((cause: unknown) => { if (active) { setMissing(cause instanceof ApiError && cause.status === 404); setError(cause instanceof Error ? cause.message : ""); } });
    return () => { active = false; };
  }, [id]);

  if (missing) return <p role="alert" className="notice error">{t("owner.edit.notFound")}</p>;
  if (!listing) return error ? <p role="alert" className="notice error">{error}</p> : <p role="status">…</p>;

  const home = isProperty(listing);
  const definition: CategoryDefinition | undefined = definitions?.find((candidate) => candidate.id === listing.category);
  if (!home && !definition) return <p role="status">…</p>;
  const current = listing;
  const keptPhotos = kept ?? current.photoUrls;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const contact = normalizeContactPhone(phone);
    if (!contact) { setError(t("rent.book.phoneHelp")); return; }
    if (photos.uploading || photos.failed) return;

    const changes: Record<string, unknown> = {};
    let reviewed = false;
    const material = (key: string, value: unknown, before: unknown) => { if (!sameJson(value, before)) { changes[key] = value; reviewed = true; } };
    const immediate = (key: string, value: unknown, before: unknown) => { if (!sameJson(value, before)) changes[key] = value; };

    material("areaText", text("areaText"), current.areaText);
    const oldLocation = current.latitude != null && current.longitude != null
      ? { lat: Number(current.latitude), lng: Number(current.longitude) }
      : null;
    if (!sameJson(location, oldLocation)) {
      changes.latitude = location?.lat ?? null;
      changes.longitude = location?.lng ?? null;
      reviewed = true;
    }
    const nextPhotos = [...keptPhotos, ...photos.urls];
    if (nextPhotos.length > 10) { setError(t("owner.edit.tooManyPhotos")); return; }
    material("photoUrls", nextPhotos, current.photoUrls);
    immediate("ownerContact", contact, current.ownerContact);
    if (home) {
      immediate("monthlyRent", Number(text("monthlyRent")), current.monthlyRent);
      immediate("minDurationMonths", Number(text("minDurationMonths")), current.minDurationMonths);
      if (keyMoney !== Boolean(current.keyMoney) || (keyMoney && Number(text("keyMoneyAmount")) !== current.keyMoneyAmount)) {
        changes.keyMoney = keyMoney;
        if (keyMoney) changes.keyMoneyAmount = Number(text("keyMoneyAmount"));
      }
    } else if (definition) {
      material("title", text("title"), current.title);
      material("description", text("description"), current.description ?? "");
      material("attributes", readAttributes(definition, form), current.attributes);
      immediate("rate", Number(text("rate")), current.monthlyRent);
      immediate("ratePeriod", text("ratePeriod"), current.ratePeriod);
      immediate("depositAmount", text("depositAmount") ? Number(text("depositAmount")) : 0, current.depositAmount ?? 0);
    }
    if (!Object.keys(changes).length) { setError(""); setSaved("now"); return; }

    setBusy(true);
    setError("");
    setSaved("");
    try {
      setListing(await apiRequest<OwnerListing>(`/listings/${current.id}`, { method: "PATCH", authenticated: true, body: JSON.stringify(changes) }));
      setSaved(reviewed && (current.status === "ACTIVE" || current.status === "REJECTED") ? "review" : "now");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "");
      requestAnimationFrame(() => alert.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return <section className="owner-new">
    <div className="page-heading"><div>
      <p className="eyebrow"><Link href="/owner/listings">← {t("nav.myProperties")}</Link></p>
      <h1>{t("owner.edit.title")}: {current.title ?? current.areaText}</h1>
      <p className="intro">{t("owner.edit.review")}</p>
    </div></div>
    <form className="owner-form" onSubmit={(event) => void submit(event)} aria-busy={busy} key={`${current.id}-${current.areaText}-${current.monthlyRent}`}>
      {error && <p ref={alert} tabIndex={-1} role="alert" className="notice error">{error}</p>}
      {saved && <p role="status" className="notice">{saved === "review" ? t("owner.edit.savedReview") : t("owner.edit.saved")}</p>}
      <fieldset className="panel form-grid two-columns" disabled={busy}>
        {!home && <label className="full-width">{t("rent.new.titleField")}<input name="title" defaultValue={current.title ?? ""} minLength={3} maxLength={120} required /></label>}
        {!home && definition && <DynamicFields category={definition} values={current.attributes} disabled={busy} />}
        {!home && <label className="full-width">{t("rent.new.description")}<textarea name="description" rows={4} maxLength={2000} defaultValue={current.description ?? ""} /></label>}
        <label className="full-width">{t(home ? "filter.area" : "rent.new.area")}<input name="areaText" defaultValue={current.areaText} maxLength={300} required /></label>
        {home ? <>
          <label>{t("owner.edit.monthlyRent")}<input name="monthlyRent" type="number" inputMode="numeric" min={1} step={1} defaultValue={current.monthlyRent} required /></label>
          <label>{t("owner.edit.minStay")}<input name="minDurationMonths" type="number" inputMode="numeric" min={1} max={1200} step={1} defaultValue={current.minDurationMonths ?? ""} required /></label>
          <label className="checkbox option-row"><input type="checkbox" checked={keyMoney} onChange={(event) => setKeyMoney(event.target.checked)} />{t("owner.edit.keyMoney")}</label>
          {keyMoney && <label>{t("owner.edit.keyMoneyAmount")}<input name="keyMoneyAmount" type="number" inputMode="numeric" min={1} step={1} defaultValue={current.keyMoneyAmount ?? ""} required /></label>}
        </> : <>
          <label>{t("rent.new.rate")}<input name="rate" type="number" inputMode="numeric" min={1} step={1} defaultValue={current.monthlyRent} required /></label>
          <label>{t("rent.new.period")}<select name="ratePeriod" defaultValue={current.ratePeriod ?? "DAY"}>{definition?.ratePeriods.map((period) => <option key={period} value={period}>{t(`rent.per.${period}`)}</option>)}</select></label>
          <label>{t("rent.new.deposit")}<input name="depositAmount" type="number" inputMode="numeric" min={0} step={1} defaultValue={current.depositAmount ?? ""} /></label>
        </>}
        <label>{t("rent.book.phone")}
          <span className="phone-input"><span aria-hidden="true">+94</span><input type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></span>
          <small>{t("rent.book.phoneHelp")}</small></label>
      </fieldset>
      <div className="panel"><h2 className="side-title">{t("rent.new.locationTitle")}</h2><ListingLocationPicker value={location} onChange={setLocation} disabled={busy} /></div>
      <div className="panel">
        <h2 className="side-title">{t("owner.edit.photos")}</h2>
        {keptPhotos.length > 0 && <ul className="thumb-row photo-edit-row">{keptPhotos.map((url) =>
          <li key={url}><PropertyImage src={url} alt="" width={160} height={100} sizes="120px" />
            <button type="button" className="text-button" disabled={busy} onClick={() => setKept(keptPhotos.filter((photo) => photo !== url))}>{t("owner.edit.photoRemove")}</button></li>)}</ul>}
        <p className="small-copy">{t("owner.edit.photosHint")}</p>
        <PropertyPhotoPicker key={`${current.id}-${current.photoUrls.length}`} onChange={setPhotos} disabled={busy} />
      </div>
      <div className="wizard-actions"><span /><button className="ui-button ui-button-primary" disabled={busy || photos.uploading}>{busy ? t("rent.book.busy") : t("owner.edit.save")}</button></div>
    </form>
    {!home && <BlockedDates listingId={current.id} />}
  </section>;
}
