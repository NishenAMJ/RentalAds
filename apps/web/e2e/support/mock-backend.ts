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
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
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
    if (path === "/listings" && method === "GET") return json(route, page([{ ...sampleListing, status: "ACTIVE" }]));
    if (path === "/listings" && method === "POST") return json(route, { ...sampleListing, ...(body as object) }, 201);
    if (path === "/listings/mine" || path === "/listings/pending") return json(route, page([sampleListing]));
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
