import type { Page, Route } from "@playwright/test";

export const API = "http://localhost:3999";
export const SUPABASE = "https://test.supabase.co";

export type Role = "RENTER" | "OWNER" | "ADMIN";
export interface RecordedCall { method: string; path: string; query: URLSearchParams; body: unknown }

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LISTING_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date().toISOString();

export const sampleListing = {
  id: LISTING_ID, reference: "SL-000001", propertyType: "APARTMENT", size: "TWO_BR", bedrooms: 2, bathrooms: 2, parking: true,
  furnishing: "SEMI_FURNISHED", areaText: "Colombo 5", mapLink: null, monthlyRent: 95000, minDurationMonths: 12,
  keyMoney: false, keyMoneyAmount: null, photoUrls: [], lastAvailabilityConfirmedAt: NOW, createdAt: NOW,
  approximateLocation: null, ownerContact: "+94712345678", latitude: null, longitude: null, status: "PENDING_APPROVAL",
};

export const ITEM_ID = "66666666-6666-4666-8666-666666666666";
export const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
export const sampleItem = {
  id: ITEM_ID, reference: null, category: "VEHICLE", title: "Toyota Aqua", description: "Hybrid hatchback, easy to drive.",
  attributes: { vehicleType: "CAR", transmission: "AUTOMATIC", fuel: "HYBRID", seats: 5, withDriver: false }, depositAmount: 10000,
  areaText: "Galle", mapLink: null, monthlyRent: 5000, ratePeriod: "DAY", photoUrls: [], lastAvailabilityConfirmedAt: NOW, createdAt: NOW, approximateLocation: null,
};
const option = (category: string, field: string, value: string) => ({ value, labelKey: `cat.${category}.${field}.${value}` });
const select = (category: string, key: string, values: string[]) => ({ key, type: "select", labelKey: `cat.${category}.${key}`, required: true, options: values.map((value) => option(category, key, value)) });
/** The same shape as the API's GET /categories, trimmed to what the pages under test use. */
export const sampleCategories = [
  { id: "PROPERTY", flow: "CONCIERGE", ratePeriods: ["MONTH"], fields: [] },
  { id: "VEHICLE", flow: "BOOKING", ratePeriods: ["DAY", "WEEK"], typeField: "vehicleType", fields: [
    select("VEHICLE", "vehicleType", ["CAR", "VAN"]), select("VEHICLE", "transmission", ["MANUAL", "AUTOMATIC"]), select("VEHICLE", "fuel", ["PETROL", "HYBRID"]),
    { key: "seats", type: "number", labelKey: "cat.VEHICLE.seats", required: true, min: 1, max: 60 }, { key: "withDriver", type: "boolean", labelKey: "cat.VEHICLE.withDriver", required: false },
  ] },
  { id: "EQUIPMENT", flow: "BOOKING", ratePeriods: ["DAY", "WEEK"], typeField: "equipmentType", fields: [select("EQUIPMENT", "equipmentType", ["CAMERA", "OTHER"])] },
  { id: "EVENT_GEAR", flow: "BOOKING", ratePeriods: ["DAY"], typeField: "gearType", fields: [select("EVENT_GEAR", "gearType", ["SOUND", "TENT"])] },
];
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
export const CONFIRMED_ID = "88888888-8888-4888-8888-888888888888";
export const sampleBooking = {
  id: BOOKING_ID, status: "PENDING_PAYMENT", startDate: inDays(30), endDate: inDays(33), units: 3, ratePeriod: "DAY", rateAmount: 5000, rentalTotal: 15000,
  serviceFee: 1500, depositAmount: 10000, totalAmount: 26500, expiresAt: new Date(Date.now() + 25 * 60_000).toISOString(), paidAt: null, createdAt: NOW,
  listing: { id: ITEM_ID, reference: null, category: "VEHICLE", title: "Toyota Aqua", areaText: "Galle", photoUrl: null },
};
export const confirmedBooking = { ...sampleBooking, id: CONFIRMED_ID, status: "CONFIRMED", startDate: inDays(12), endDate: inDays(15), expiresAt: null, paidAt: NOW, ownerContact: "+94770000000", refundAmount: 0, refundStatus: "NONE" };
export const ownerItem = { ...sampleItem, photoUrls: ["https://images.example.org/aqua-1.jpg", "https://images.example.org/aqua-2.jpg"], status: "ACTIVE", ownerContact: "+94712345678", ratePeriod: "DAY", keyMoney: false, keyMoneyAmount: null, latitude: null, longitude: null, minDurationMonths: null, bedrooms: null, bathrooms: null, furnishing: null, propertyType: null, size: null, parking: false };

const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
export const sampleRequest = {
  id: REQUEST_ID, areaText: "Colombo 5", budgetMin: null, budgetMax: 100000, durationMonths: 12, propertyType: "APARTMENT",
  status: "OPEN", renterContact: "+94710000002", createdAt: NOW, searchLatitude: null, searchLongitude: null, searchRadiusKm: null,
  assignedAdmin: null, adminNotes: null, followUpAt: null,
};
const criterion = (key: string, label: string, status: string, detail: string) => ({ key, label, status, detail });
const suggestionBase = { ownerContact: "+94712345678", distanceKm: null, latitude: null, longitude: null, matchId: null, status: null, score: 80, reasons: [], whatsappMessage: "Hello from the team" };
export const sampleSuggestions = [
  { ...suggestionBase, listingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", reference: "SL-000101", areaText: "Colombo 5 (best fit)", monthlyRent: 95000, matchPercentage: 92, requiresReview: false,
    criteria: [criterion("area", "Area", "matched", "Area matched exactly."), criterion("budget", "Budget", "matched", "Within budget."), criterion("propertyType", "Property type", "matched", "Apartment offered.")] },
  { ...suggestionBase, listingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", reference: "SL-000102", areaText: "Nugegoda (needs a reason)", monthlyRent: 130000, matchPercentage: 61, requiresReview: true,
    criteria: [criterion("area", "Area", "unknown", "No map pin."), criterion("budget", "Budget", "different", "LKR 30,000 over budget."), criterion("parking", "Parking", "different", "No parking offered.")] },
];

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

const page = <T,>(data: T[]) => ({ data, page: 1, limit: 20, hasNextPage: false });
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** A signed, in-date-looking token. Supabase's client only reads the expiry; nothing verifies the signature here. */
function fakeToken() {
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic`;
}

export interface Backend { calls: RecordedCall[]; called: (method: string, path: string) => RecordedCall[] }

/**
 * Replaces Supabase sign-in and the rental API for one page. Every API call is recorded
 * so tests can assert what the browser actually sent. Unknown routes fail loudly.
 */
export async function mockBackend(browserPage: Page, role: Role): Promise<Backend> {
  const calls: RecordedCall[] = [];
  const admin = role === "ADMIN";
  const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: `${role.toLowerCase()}@example.test`, app_metadata: { provider: "email" }, user_metadata: {}, created_at: NOW };

  await browserPage.route(`${SUPABASE}/auth/v1/**`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const isToken = new URL(route.request().url()).pathname.endsWith("/token");
    await route.fulfill({
      status: 200, headers: cors, contentType: "application/json",
      body: JSON.stringify(isToken ? { access_token: fakeToken(), refresh_token: "r", expires_in: 3600, token_type: "bearer", user } : user),
    });
  });

  const json = (route: Route, data: unknown, status = 200) =>
    route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(data) });

  await browserPage.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(request.url());
    const body = request.postData() ? (JSON.parse(request.postData() as string) as unknown) : undefined;
    calls.push({ method: request.method(), path: url.pathname, query: url.searchParams, body });
    const { pathname: path } = url;
    const method = request.method();

    if (path === "/users/me") return json(route, { authUserId: USER_ID, role, adminPermission: admin ? { canApproveListings: true, canManageAdmins: false, canManageComplaints: true } : null });
    if (path === "/users/me/export") return json(route, { exportedAt: NOW, account: { id: USER_ID, email: user.email }, listings: [], rentalRequests: [], complaints: [], notifications: [] });
    if (path === "/users/me/delete") return json(route, { deleted: true, signInRemoved: false });
    if (path === "/notifications/unread-count") return json(route, { count: 0 });
    if (path === "/notifications") return json(route, []);
    if (path === "/listings" && method === "GET") return json(route, page<unknown>(url.searchParams.get("category") === "VEHICLE" ? [sampleItem] : [{ ...sampleListing, status: "ACTIVE" }]));
    if (path === "/listings/items" && method === "POST") return json(route, { id: ITEM_ID, status: "PENDING_APPROVAL", ...(body as object) }, 201);
    if (path === `/listings/${ITEM_ID}` && method === "GET") return json(route, sampleItem);
    if (path === "/listings/admin") return json(route, page(url.searchParams.get("status") === "PENDING_APPROVAL" ? [sampleListing] : []));
    if (path === "/admin/summary") return json(route, { listings: { pending: 1, active: 0, inactive: 0 }, requests: { open: 1, unassigned: 1 }, bookings: { upcoming: 0, refundDue: 0 }, complaints: { open: 0 } });
    if (path === "/categories") return json(route, sampleCategories);
    if (path === `/bookings/availability/${ITEM_ID}`) return json(route, []);
    if (path === "/bookings/quote") return json(route, { days: 3, ratePeriod: "DAY", rateAmount: 5000, units: 3, rentalTotal: 15000, serviceFee: 1500, depositAmount: 10000, totalAmount: 26500 });
    if (path === "/bookings" && method === "POST") return json(route, sampleBooking, 201);
    if (path === `/bookings/${BOOKING_ID}/checkout`) return json(route, { action: "https://sandbox.payhere.lk/pay/checkout", fields: { merchant_id: "1200001", order_id: BOOKING_ID, amount: "26500.00", currency: "LKR", hash: "ABC" } }, 201);
    if (path === "/bookings/mine") return json(route, page([sampleBooking, confirmedBooking]));
    if (path === "/bookings/received") return json(route, page([{ ...confirmedBooking, renterContact: "+94771234567", ownerContact: undefined }]));
    if (path === `/bookings/${CONFIRMED_ID}/cancel-quote`) return json(route, { rule: "FULL", refundAmount: 26500, daysBeforeStart: 12 });
    if (path === `/bookings/${CONFIRMED_ID}/cancel` && method === "PATCH") return json(route, { id: CONFIRMED_ID, status: "CANCELLED", refundAmount: 26500 });
    if (path === `/bookings/${CONFIRMED_ID}/owner-cancel` && method === "PATCH") return json(route, { id: CONFIRMED_ID, status: "CANCELLED", refundAmount: 26500 });
    if (path === "/bookings/admin") return json(route, page([{ ...confirmedBooking, status: "CANCELLED", cancelledBy: "OWNER", cancelReason: "Car broke down", refundStatus: "DUE", refundAmount: 26500, refundDue: true, ownerContact: "+94770000000", renterContact: "+94771234567", paymentReference: "pay-9" }]));
    if (path === `/bookings/${CONFIRMED_ID}/refund-done` && method === "PATCH") return json(route, { id: CONFIRMED_ID, refundStatus: "DONE" });
    if (path === `/listings/mine/${ITEM_ID}`) return json(route, ownerItem);
    if (path === `/listings/${ITEM_ID}` && method === "PATCH") return json(route, { ...ownerItem, ...(body as object) });
    if (path === `/listings/${ITEM_ID}/blocks` && method === "GET") return json(route, [{ id: "99999999-9999-4999-8999-999999999999", startDate: inDays(40), endDate: inDays(42), note: "Family trip" }]);
    if (path === `/listings/${ITEM_ID}/blocks` && method === "POST") return json(route, { id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", ...(body as object) }, 201);
    if (path.startsWith(`/listings/${ITEM_ID}/blocks/`) && method === "DELETE") return json(route, { id: "gone" });
    if (path === "/listings" && method === "POST") return json(route, { ...sampleListing, ...(body as object) }, 201);
    if (path === "/listings/mine") return json(route, page<unknown>([sampleListing, ownerItem]));
    if (path === "/listings/pending") return json(route, page([sampleListing]));
    if (path === `/listings/${LISTING_ID}/approve`) return json(route, { ...sampleListing, status: "ACTIVE" });
    if (path === "/requests" && method === "POST") return json(route, { id: "33333333-3333-4333-8333-333333333333", ...(body as object) }, 201);
    if (path === "/requests" && method === "GET") return json(route, page([sampleRequest]));
    if (path === "/requests/mine") return json(route, page([]));
    if (path === `/matching/requests/${REQUEST_ID}/suggestions` && method === "GET") return json(route, page(sampleSuggestions));
    if (path === "/complaints") return json(route, page([]));
    if (path === "/matching/dashboard") return json(route, page([]));
    return json(route, { message: `Unmocked API call: ${method} ${path}` }, 501);
  });

  return { calls, called: (method, path) => calls.filter((call) => call.method === method && call.path === path) };
}

/** Signs in through the real login form, which is the only way to get a session: it is kept in memory only. */
export async function signIn(browserPage: Page) {
  await browserPage.goto("/login");
  await browserPage.getByLabel("Email").fill("person@example.test");
  await browserPage.getByLabel("Password", { exact: true }).fill("a-long-password");
  await browserPage.getByRole("button", { name: /^Sign in/ }).click();
}
