"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { RequireSession } from "@/components/require-session";
import { PropertyPhotoPicker } from "@/components/property-photo-picker";
import { apiRequest } from "@/lib/api-client";
import { normalizeContactPhone, validateListingForm, type FormIssue, type PhotoUploadState } from "@/lib/listing-form";
import type { OwnerListing } from "@/lib/listings";
import { PrivacyNote } from "@/components/ui/primitives";
const LocationPicker = dynamic(() => import("@/components/LocationPicker").then((module) => module.LocationPicker), {
  ssr: false,
  loading: () => <p role="status">Loading map...</p>,
});


function ListingForm() {
  const [propertyType, setPropertyType] = useState("HOUSE");
  const [keyMoney, setKeyMoney] = useState(false);
  const [rent, setRent] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [created, setCreated] = useState<OwnerListing | null>(null);
  const [photos, setPhotos] = useState<PhotoUploadState>({ urls: [], uploading: false, failed: false });
  const summary = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const phoneInvalid = phoneTouched && !normalizeContactPhone(phone);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const stepOf = (field: string) => ["monthlyRent", "minDurationMonths", "keyMoneyAmount", "contactPhone"].includes(field) ? 1 : field === "photos" ? 2 : 0;
  function show(next: number) { setStep(next); requestAnimationFrame(() => heading.current?.focus()); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const problems = validateListingForm(form, photos, location);
    if (step < 2) {
      const here = problems.filter((issue) => stepOf(issue.field) === step);
      setIssues(here); setPhoneTouched(step === 1); setError("");
      if (here.length) { requestAnimationFrame(() => summary.current?.focus()); return; }
      show(step + 1); return;
    }
    setIssues(problems); setPhoneTouched(true); setError("");
    if (problems.length) {
      const first = Math.min(...problems.map((issue) => stepOf(issue.field)));
      if (first < step) setStep(first);
      requestAnimationFrame(() => summary.current?.focus()); return;
    }
    const text = (name: string) => String(form.get(name) ?? "").trim();
    setBusy(true);
    try {
      const payload = {
        propertyType, size: propertyType === "HOUSE" ? "N_A" : text("size"),
        bedrooms: Number(text("bedrooms")), bathrooms: Number(text("bathrooms")),
        parking: form.has("parking"), furnishing: text("furnishing"), areaText: text("areaText"),
        ...(text("mapLink") ? { mapLink: text("mapLink") } : {}),
        latitude: location?.lat,
        longitude: location?.lng,
        monthlyRent: Number(text("monthlyRent")), minDurationMonths: Number(text("minDurationMonths")),
        keyMoney, ...(keyMoney ? { keyMoneyAmount: Number(text("keyMoneyAmount")) } : {}),
        ownerContact: normalizeContactPhone(phone), photoUrls: photos.urls,
      };
      setCreated(await apiRequest<OwnerListing>("/listings", { method: "POST", authenticated: true, body: JSON.stringify(payload) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit property."); requestAnimationFrame(() => summary.current?.focus()); }
    finally { setBusy(false); }
  }

  if (created) return <div className="panel request-success" role="status"><p className="eyebrow">Pending approval</p><h2>Your property has been submitted.</h2><p>We will review your listing in {created.areaText} before it appears publicly.</p><Link className="button" href="/owner/listings">View my properties</Link></div>;
  const steps = [["Property basics", "Type, rooms & area"], ["Rent & contact", "Terms & phone"], ["Photos & submit", "Images & review"]];
  const titles = ["Physical specifications", "Rent, terms & contact", "Photos & submission"];
  return <form className="wizard" onSubmit={submit} noValidate>
    <ol className="form-stepper" aria-label="Listing progress">{steps.map(([label, hint], index) => <li key={label} aria-current={step === index ? "step" : undefined} className={index <= step ? "step-reached" : ""}><span aria-hidden="true">{index < step ? "✓" : index + 1}</span><div><strong>{label}</strong><small>{hint}</small></div></li>)}</ol>
    {(issues.length > 0 || error) && <div ref={summary} className="notice error" role="alert" tabIndex={-1}><h2>Please check your listing</h2>{error && <p>{error}</p>}<ul>{issues.map((issue) => <li key={issue.field}><a href={`#${issue.field}`} onClick={() => setStep(stepOf(issue.field))}>{issue.message}</a></li>)}</ul></div>}
    <p className="eyebrow">Step {step + 1} of 3</p>
    <h2 ref={heading} tabIndex={-1} className="wizard-title">{titles[step]}</h2>
    <fieldset disabled={busy} className="wizard-fieldset">
      <div hidden={step !== 0} className="wizard-step split">
        <div className="panel form-grid two-columns">
          <p className="full-width small-copy">Fields marked (required) must be completed.</p>
          <label>Property type (required)<select id="propertyType" name="propertyType" value={propertyType} onChange={(event) => setPropertyType(event.target.value)} required><option value="HOUSE">House</option><option value="APARTMENT">Apartment</option></select></label>
          {propertyType === "APARTMENT" && <label>Size (required)<select id="size" name="size" defaultValue="" required><option value="" disabled>Select apartment size</option><option value="STUDIO">Studio</option><option value="ONE_BR">One bedroom</option><option value="TWO_BR">Two bedrooms</option><option value="THREE_BR_PLUS">Three or more bedrooms</option></select></label>}
          <label>Bedrooms (required)<input id="bedrooms" name="bedrooms" type="number" min={0} max={100} step={1} defaultValue={2} required /><small>Use 0 for a studio.</small></label>
          <label>Bathrooms (required)<input id="bathrooms" name="bathrooms" type="number" min={1} max={100} step={1} defaultValue={1} required /></label>
          <label>Furnishing (required)<select id="furnishing" name="furnishing" defaultValue="UNFURNISHED" required><option value="UNFURNISHED">Unfurnished</option><option value="SEMI_FURNISHED">Semi furnished</option><option value="FURNISHED">Furnished</option></select></label>
          <label>Area (required)<input id="areaText" name="areaText" placeholder="e.g. Nugegoda" maxLength={300} required /><small>Enter the town or area name matching your pin.</small></label>
          <label className="checkbox option-row full-width"><input name="parking" type="checkbox" />Parking available (optional)</label>
        </div>
        <div className="panel location-panel">
          <h3>Property location</h3>
          <div id="location" tabIndex={-1}>
            <p className="small-copy">Optional. Click the map to drop a pin, or drag it to adjust.</p>
            <LocationPicker value={location} onChange={setLocation} disabled={busy} />
            {location && <button type="button" className="secondary" onClick={() => setLocation(null)}>Clear pin</button>}
          </div>
          <label>Map link (optional){location ? <input key="pin" id="mapLink" name="mapLink" readOnly value={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`} /> : <input key="manual" id="mapLink" name="mapLink" type="url" maxLength={2048} placeholder="https://…" />}<small>A selected pin automatically creates this link.</small></label>
          <PrivacyNote>Your exact address is not published on public listings.</PrivacyNote>
        </div>
      </div>
      <div hidden={step !== 1} className="wizard-step">
        <div className="panel form-grid two-columns">
          <label>Monthly rent (LKR) (required)<input id="monthlyRent" name="monthlyRent" type="number" min={1} max={2147483647} step={1} placeholder="e.g. 85000" value={rent} onChange={(event) => setRent(event.target.value)} required aria-describedby="rent-display" /><small id="rent-display" aria-live="polite">{rent && Number.isFinite(Number(rent)) && Number(rent) >= 0 ? `LKR ${Number(rent).toLocaleString("en-US")} per month` : "Enter the monthly amount in whole rupees."}</small></label>
          <label>Minimum stay (months) (required)<input id="minDurationMonths" name="minDurationMonths" type="number" min={1} max={1200} step={1} defaultValue={12} required /></label>
          <div className="full-width"><label className="checkbox option-row"><input name="keyMoney" type="checkbox" checked={keyMoney} onChange={(event) => setKeyMoney(event.target.checked)} />Key money required (optional)</label>
            {keyMoney && <label className="conditional-field">Key money amount (LKR) (required)<input id="keyMoneyAmount" name="keyMoneyAmount" type="number" min={1} max={2147483647} step={1} placeholder="e.g. 150000" required /></label>}
          </div>
          <label className="full-width">Contact phone number (required)<span className="phone-input"><span aria-hidden="true">+94</span><input id="contactPhone" name="contactPhone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="71 234 5678" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} onBlur={() => setPhoneTouched(true)} required aria-label="Contact phone number after country code +94" aria-invalid={Boolean(phoneInvalid)} aria-describedby={phoneInvalid ? "phone-help phone-error" : "phone-help"} /></span><small id="phone-help">Enter 9 digits starting with 7 after +94, without the leading 0.</small>{phoneInvalid && <small id="phone-error" className="field-error">Enter a valid mobile number, such as 71 234 5678.</small>}<small>Used for coordination. This contact field is not shown on public listings.</small></label>
        </div>
      </div>
      <div hidden={step !== 2} className="wizard-step">
        <div className="panel"><PropertyPhotoPicker onChange={setPhotos} disabled={busy} /></div>
      </div>
    </fieldset>
    <div className="wizard-actions">
      {step > 0 ? <button type="button" className="ui-button ui-button-ghost" disabled={busy} onClick={() => show(step - 1)}>← Back</button> : <span className="small-copy"><span className="live-dot" />Your exact address stays private.</span>}
      {step < 2 ? <button type="submit" className="ui-button ui-button-primary">{step === 0 ? "Continue to rent & contact →" : "Continue to photos →"}</button>
        : <button disabled={busy || photos.uploading}>{busy ? "Submitting…" : photos.uploading ? "Waiting for photos…" : "Submit for approval →"}</button>}
    </div>
  </form>;
}

export default function NewListingPage() {
  return <section className="owner-new"><div className="page-heading"><div><p className="eyebrow">For property owners</p><h1>Open the door to your next tenant.</h1><p className="intro">Tell us about your property. Every listing is reviewed before it goes live.</p></div></div><RequireSession><ListingForm /></RequireSession></section>;
}
