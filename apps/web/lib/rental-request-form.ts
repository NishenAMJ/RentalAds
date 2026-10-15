import type { SearchArea } from "./search-area";
export interface RentalRequestForm {
  searchArea?: SearchArea | null;
  areaText: string; budgetMin: string; budgetMax: string; durationMonths: string;
  propertyType: "APARTMENT" | "HOUSE"; size: string; bedrooms: string;
  parking: boolean; furnishing: string; renterContact: string;
}
export type RequestErrors = Partial<Record<keyof RentalRequestForm, string>>;
export const initialRequest: RentalRequestForm = { areaText: "", budgetMin: "", budgetMax: "", durationMonths: "12", propertyType: "APARTMENT", size: "", bedrooms: "", parking: false, furnishing: "", renterContact: "" };
export function validateRequestStep(form: RentalRequestForm, step: number): RequestErrors {
  const errors: RequestErrors = {};
  const integer = (value: string, min: number, max: number) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
  if (step === 0 && (!form.areaText.trim() || form.areaText.trim().length > 300)) errors.areaText = "Enter your preferred areas using 1–300 characters.";
  if (step === 0 && form.searchArea && (!Number.isFinite(form.searchArea.lat) || Math.abs(form.searchArea.lat) > 90 || !Number.isFinite(form.searchArea.lng) || Math.abs(form.searchArea.lng) > 180 || !Number.isFinite(form.searchArea.radiusKm) || form.searchArea.radiusKm < 1 || form.searchArea.radiusKm > 10)) errors.searchArea = "Choose a valid centre and a radius from 1 to 10 km.";
  if (step === 1) {
    if (!integer(form.budgetMax, 1, 2147483647)) errors.budgetMax = "Enter a monthly budget of at least LKR 1, in whole rupees.";
    if (form.budgetMin && (!integer(form.budgetMin, 0, 2147483647) || Number(form.budgetMin) > Number(form.budgetMax))) errors.budgetMin = "Minimum budget must be a whole amount below your maximum.";
    if (!integer(form.durationMonths, 1, 1200)) errors.durationMonths = "Enter a stay of 1–1,200 months.";
  }
  if (step === 2) {
    if (!["HOUSE", "APARTMENT"].includes(form.propertyType)) errors.propertyType = "Choose a property type.";
    if (form.bedrooms && !integer(form.bedrooms, 0, 100)) errors.bedrooms = "Enter 0–100 bedrooms; use 0 for a studio.";
    if (form.propertyType === "APARTMENT" && !["", "STUDIO", "ONE_BR", "TWO_BR", "THREE_BR_PLUS"].includes(form.size)) errors.size = "Choose an apartment size.";
    if (!["", "FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"].includes(form.furnishing)) errors.furnishing = "Choose a furnishing preference.";
  }
  if (step === 3 && !/^7\d{8}$/.test(form.renterContact.replace(/[\s-]/g, ""))) errors.renterContact = "Enter 9 digits starting with 7, without +94 or a leading 0.";
  return errors;
}
export function requestPayload(form: RentalRequestForm) {
  return { ...(form.searchArea ? { searchLatitude: form.searchArea.lat, searchLongitude: form.searchArea.lng, searchRadiusKm: form.searchArea.radiusKm } : {}), areaText: form.areaText.trim(), budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
    budgetMax: Number(form.budgetMax), durationMonths: Number(form.durationMonths), propertyType: form.propertyType,
    size: form.propertyType === "APARTMENT" && form.size ? form.size : undefined,
    bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined, parking: form.parking ? true : undefined,
    furnishing: form.furnishing || undefined, renterContact: `+94${form.renterContact.replace(/[\s-]/g, "")}` };
}
