"use client";

import { useRef, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api-client";
import { initialRequest, requestPayload, validateRequestStep, type RentalRequestForm, type RequestErrors } from "@/lib/rental-request-form";
import { ActionLink, Badge, Button, InputField, PrivacyNote, SelectField } from "@/components/ui/primitives";

import { SearchAreaPicker } from "./search-area-picker";
import { SavedSearchAreaView } from "./saved-search-area";

const steps = ["Your area", "Your budget", "Your home", "Your introduction"];
const stepHints = ["Areas & radius", "LKR range & terms", "Layout & furnishing", "Contact via WhatsApp"];
const titles = ["Where would you feel at home?", "A budget that works for you.", "The details make the difference.", "Let’s make it personal."];
export function RenterRequestForm() {
  const [form, setForm] = useState<RentalRequestForm>(initialRequest);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<RequestErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  function update<K extends keyof RentalRequestForm>(key: K, value: RentalRequestForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  }
  function go(next: number) { setStep(next); setErrors({}); setError(""); requestAnimationFrame(() => heading.current?.focus()); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const invalid = validateRequestStep(form, step);
    if (Object.keys(invalid).length) { setErrors(invalid); requestAnimationFrame(() => summary.current?.focus()); return; }
    if (step < 3) { go(step + 1); return; }
    for (let index = 0; index < 3; index++) {
      const previous = validateRequestStep(form, index);
      if (Object.keys(previous).length) { setStep(index); setErrors(previous); requestAnimationFrame(() => summary.current?.focus()); return; }
    }
    inFlight.current = true; setBusy(true); setError("");
    try {
      await apiRequest("/requests", { method: "POST", authenticated: true, body: JSON.stringify(requestPayload(form)) });
      setSent(true); requestAnimationFrame(() => heading.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t send your request. Please try again."); requestAnimationFrame(() => summary.current?.focus()); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (sent) return <section className="request-success panel"><Badge tone="success">Request received</Badge><h1 ref={heading} tabIndex={-1}>Your search is in good hands.</h1><p>Our team will review your preferences for <strong>{form.areaText}</strong>. When we find a potential fit, we’ll contact you on WhatsApp to coordinate an introduction.</p><PrivacyNote>Your request is private. Submitting a request does not guarantee a match.</PrivacyNote><ActionLink href="/renter/dashboard">View my requests →</ActionLink></section>;
  return <div className="request-flow"><ol className="form-stepper" aria-label="Request progress">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={index <= step ? "step-reached" : ""}><span aria-hidden="true">{index < step ? "✓" : index + 1}</span><div><strong>{label}</strong><small>{stepHints[index]}</small></div></li>)}</ol><div className="request-layout"><aside className="request-aside"><p className="eyebrow">Your private property brief</p><h1>Finding home,<br /><em>together.</em></h1><p>A few details help our Colombo team understand what matters to you.</p><PrivacyNote /><div className="concierge-note"><span className="eyebrow">What happens next</span><p>We review your preferences, look for suitable homes, and coordinate introductions personally via WhatsApp.</p></div></aside>
    <section className="request-panel panel" aria-label="Private rental request">
      <p className="eyebrow">Step {step + 1} of 4</p><h2 ref={heading} tabIndex={-1}>{titles[step]}</h2>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        {(error || Object.values(errors).some(Boolean)) && <div className="notice error" role="alert" tabIndex={-1} ref={summary}>{error || "Please check the highlighted details below."}</div>}
        <fieldset disabled={busy} className="request-fields"><legend className="sr-only">{steps[step]}</legend>
          {step === 0 && <><p className="muted">Choose the neighbourhoods you love. It’s fine to have more than one in mind.</p><InputField id="areaText" label="Preferred areas (required)" placeholder="e.g. Colombo 5, Nugegoda, Rajagiriya" maxLength={300} value={form.areaText} onChange={e => update("areaText", e.target.value)} error={errors.areaText} required /><div className="area-suggestions"><span>Ideas to get you started</span><div className="chips">{["Colombo 3", "Colombo 5", "Colombo 7", "Nugegoda", "Rajagiriya"].map(area => <Button key={area} variant="secondary" onClick={() => { const areas = form.areaText.split(",").map(value => value.trim()).filter(Boolean); if (!areas.includes(area)) update("areaText", [...areas, area].join(", ")); }}>+ {area}</Button>)}</div></div><SearchAreaPicker value={form.searchArea ?? null} onChange={area => update("searchArea", area)} />{errors.searchArea && <p role="alert">{errors.searchArea}</p>}</>}
          {step === 1 && <><p className="muted">Monthly rent in Sri Lankan rupees. Give us a comfortable range.</p><div className="field-grid"><InputField id="budgetMin" label="Minimum budget (optional)" type="number" min={0} max={2147483647} step={1} placeholder="LKR 50,000" value={form.budgetMin} onChange={e => update("budgetMin", e.target.value)} error={errors.budgetMin} /><InputField id="budgetMax" label="Maximum budget (required)" type="number" min={1} max={2147483647} step={1} placeholder="LKR 100,000" value={form.budgetMax} onChange={e => update("budgetMax", e.target.value)} error={errors.budgetMax} required /></div><InputField id="durationMonths" label="Minimum stay in months (required)" type="number" min={1} max={1200} value={form.durationMonths} onChange={e => update("durationMonths", e.target.value)} error={errors.durationMonths} required /><div className="budget-preview" aria-live="polite">{form.budgetMax && Number.isFinite(Number(form.budgetMax)) && Number(form.budgetMax) > 0 ? <>Up to <strong>LKR {Number(form.budgetMax).toLocaleString("en-LK")}</strong> per month</> : "Your budget helps us focus on homes that fit."}</div></>}
          {step === 2 && <><div className="field-grid"><SelectField id="propertyType" label="Property type" value={form.propertyType} onChange={e => update("propertyType", e.target.value as RentalRequestForm["propertyType"])} error={errors.propertyType}><option value="APARTMENT">Apartment</option><option value="HOUSE">House</option></SelectField><InputField id="bedrooms" label="Bedrooms (optional)" type="number" min={0} max={100} placeholder="Any" hint="Use 0 for a studio." value={form.bedrooms} onChange={e => update("bedrooms", e.target.value)} error={errors.bedrooms} /></div>{form.propertyType === "APARTMENT" && <SelectField id="size" label="Apartment size" value={form.size} onChange={e => update("size", e.target.value)} error={errors.size}><option value="">No preference</option><option value="STUDIO">Studio</option><option value="ONE_BR">1 bedroom</option><option value="TWO_BR">2 bedrooms</option><option value="THREE_BR_PLUS">3+ bedrooms</option></SelectField>}<SelectField id="furnishing" label="Furnishing" value={form.furnishing} onChange={e => update("furnishing", e.target.value)} error={errors.furnishing}><option value="">No preference</option><option value="FURNISHED">Furnished</option><option value="SEMI_FURNISHED">Semi-furnished</option><option value="UNFURNISHED">Unfurnished</option></SelectField><label className="checkbox option-row"><input type="checkbox" checked={form.parking} onChange={e => update("parking", e.target.checked)} /> Parking is essential</label><p className="muted small-copy">Have a specific bathroom requirement? Share it with our team when they contact you.</p></>}
          {step === 3 && <><p className="muted">Review your brief, then tell us where to reach you.</p><dl className="request-review"><div><dt>Preferred areas</dt><dd>{form.areaText}</dd></div><div><dt>Monthly budget</dt><dd>{form.budgetMin ? `LKR ${Number(form.budgetMin).toLocaleString("en-LK")} – ` : "Up to "}LKR {Number(form.budgetMax).toLocaleString("en-LK")}</dd></div><div><dt>Your home</dt><dd>{form.propertyType === "HOUSE" ? "House" : "Apartment"} · {form.bedrooms || "Any"} bedrooms · {form.durationMonths} months</dd></div><div><dt>Preferences</dt><dd>{form.furnishing ? form.furnishing.toLowerCase().replaceAll("_", " ") : "Any furnishing"}{form.parking ? " · Parking required" : ""}{form.propertyType === "APARTMENT" && form.size ? ` · ${form.size.toLowerCase().replaceAll("_", " ")}` : ""}</dd></div></dl><SavedSearchAreaView request={requestPayload(form)} /><InputField id="renterContact" label="WhatsApp mobile number (required)" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="71 234 5678" hint="Sri Lanka (+94). Enter 9 digits starting with 7. Our team uses this number to discuss potential matches." value={form.renterContact} onChange={e => update("renterContact", e.target.value)} error={errors.renterContact} required /><PrivacyNote>Only you and our admin team can view this request. Your number is never published.</PrivacyNote></>}
        </fieldset>
        <div className="wizard-actions">{step > 0 ? <Button variant="ghost" disabled={busy} onClick={() => go(step - 1)}>← Back</Button> : <span className="small-copy muted">A few details. A personal search.</span>}<Button type="submit" busy={busy}>{busy ? "Sending your request…" : step === 3 ? "Send private request ↗" : "Continue →"}</Button></div>
      </form>
    </section>
  </div></div>;
}
