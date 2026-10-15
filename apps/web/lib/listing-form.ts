export interface FormIssue { field: string; message: string }
export interface PhotoUploadState { urls: string[]; uploading: boolean; failed: boolean }

export function normalizeContactPhone(value: string): string | null {
  const digits = value.replace(/[\s-]/g, "");
  return /^7[0-9]{8}$/.test(digits) ? `+94${digits}` : null;
}

export function validateListingForm(form: FormData, photos: PhotoUploadState, location?: { lat: number; lng: number } | null): FormIssue[] {
  const issues: FormIssue[] = [];
  if (location && (!Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180)) {
    issues.push({ field: "location", message: "Select a valid location on the map or clear the pin." });
  }
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const number = (key: string, label: string, min: number, max: number) => {
    const raw = text(key);
    if (!raw || !/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
      issues.push({ field: key, message: `${label} must be a whole number from ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.` });
    }
  };
  if (!["HOUSE", "APARTMENT"].includes(text("propertyType"))) issues.push({ field: "propertyType", message: "Select a property type." });
  if (text("propertyType") === "APARTMENT" && !["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR_PLUS"].includes(text("size"))) issues.push({ field: "size", message: "Select an apartment size." });
  number("bedrooms", "Bedrooms", 0, 100);
  number("bathrooms", "Bathrooms", 1, 100);
  number("monthlyRent", "Monthly rent", 1, 2147483647);
  number("minDurationMonths", "Minimum stay", 1, 1200);
  if (form.has("keyMoney")) number("keyMoneyAmount", "Key money amount", 1, 2147483647);
  if (!text("areaText") || text("areaText").length > 300) issues.push({ field: "areaText", message: "Enter an area using 1 to 300 characters." });
  if (!["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"].includes(text("furnishing"))) issues.push({ field: "furnishing", message: "Select the furnishing status." });
  if (!normalizeContactPhone(text("contactPhone"))) issues.push({ field: "contactPhone", message: "Contact phone number must have 9 digits after +94, starting with 7 (for example, 71 234 5678)." });
  if (text("mapLink")) {
    try {
      const url = new URL(text("mapLink"));
      if (!["http:", "https:"].includes(url.protocol) || text("mapLink").length > 2048) throw new Error();
    } catch { issues.push({ field: "mapLink", message: "Enter a valid http:// or https:// map link, or leave it blank." }); }
  }
  if (photos.uploading) issues.push({ field: "photos", message: "Wait for all photos to finish uploading." });
  if (photos.failed) issues.push({ field: "photos", message: "Remove failed photos and select them again before submitting." });
  return issues;
}
