import { expect, test } from "@playwright/test";
import { BOOKING_ID, CONFIRMED_ID, ITEM_ID, mockBackend, signIn } from "./support/mock-backend";

test.describe("public visitors", () => {
  test("can browse homes and filters are sent to the API", async ({ page }) => {
    const backend = await mockBackend(page, "RENTER");
    await page.goto("/listings");
    await expect(page.getByRole("heading", { name: "A place to call home." })).toBeVisible();
    await expect(page.getByRole("link", { name: /Colombo 5/ })).toBeVisible();

    await page.getByLabel("Area").fill("Nugegoda");
    await page.getByLabel("Max rent (LKR)").fill("120000");
    await page.getByLabel("Parking").check();
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/area=Nugegoda/);
    await expect.poll(() => backend.calls.at(-1)?.query.get("maxRent")).toBe("120000");
    const last = backend.calls.filter((call) => call.path === "/listings").at(-1);
    expect(last?.query.get("area")).toBe("Nugegoda");
    expect(last?.query.get("parking")).toBe("true");

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/listings$/);
  });

  test("can switch to light mode and the choice is remembered", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/");
    const html = page.locator("html");
    await page.getByRole("button", { name: /Switch to (light|dark) mode/ }).click();
    const chosen = await html.getAttribute("data-theme");
    expect(["light", "dark"]).toContain(chosen);
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", chosen as string);
  });

  test("legal pages are reachable from the footer", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/");
    await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacy" }).click();
    await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
  });
});

test.describe("home page hero", () => {
  const HEADLINE = /Rent what you need\.\s*From people nearby\./;

  test("has no illustration and types the headline, then shows the buttons", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Browse rentals" })).toHaveAttribute("href", "/categories");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Find a home" })).toHaveAttribute("href", "/renter/new");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "List a rental" })).toHaveAttribute("href", "/owner/start");
    await expect(page.locator(".hero-art")).toHaveCount(0);
    // Assistive technology and search engines get the complete headline straight away, before any typing.
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeAttached();
    // The buttons wait until the text is in place.
    const buttons = page.locator(".hero-reveal");
    await expect(buttons).toHaveAttribute("data-pending", "true");
    await expect(page.locator("h1 .tw-live")).toHaveText(HEADLINE, { timeout: 15000 });
    await expect(page.locator(".intro .tw-live")).toContainText("Find a home with our team", { timeout: 15000 });
    await expect(buttons).toHaveAttribute("data-pending", "false");
    await expect(page.getByRole("link", { name: /Find a home/ }).first()).toBeVisible();
    await expect(page.locator(".tw-cursor")).toHaveCount(0);
  });

  test("types again after a refresh, but not when you return to Home without reloading", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/");
    await expect(page.locator(".hero-reveal")).toHaveAttribute("data-pending", "false", { timeout: 15000 });

    // Leaving and coming back inside the app shows the finished text straight away.
    await page.getByRole("link", { name: /Browse categories/ }).first().click();
    await expect(page).toHaveURL(/\/categories/);
    await page.locator(".brand").first().click();
    await expect(page.locator("h1 .tw-live")).toHaveText(HEADLINE);
    await expect(page.locator(".hero-reveal")).toHaveAttribute("data-pending", "false");

    // A real refresh starts the typing again.
    await page.reload();
    await expect(page.locator(".hero-reveal")).toHaveAttribute("data-pending", "true");
    await expect(page.locator(".hero-reveal")).toHaveAttribute("data-pending", "false", { timeout: 15000 });
    await expect(page.locator("h1 .tw-live")).toHaveText(HEADLINE);
  });

  test("switching language after the typing has finished changes the text at once", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/");
    await expect(page.locator(".hero-reveal")).toHaveAttribute("data-pending", "false", { timeout: 15000 });
    await page.getByLabel("Language").selectOption("si");
    await expect(page.locator("h1 .tw-live")).toContainText("කුලියට ගන්න");
    await expect(page.locator(".tw-cursor")).toHaveCount(0);
  });

  test.describe("when the visitor prefers reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("shows all of the text and the buttons immediately", async ({ page }) => {
      await mockBackend(page, "RENTER");
      await page.goto("/");
      await expect(page.locator("h1 .tw-live")).toHaveText(HEADLINE);
      await expect(page.locator(".hero-reveal")).toHaveAttribute("data-pending", "false");
      await expect(page.locator(".tw-cursor")).toHaveCount(0);
    });
  });
});

test.describe("language and account", () => {
  test("language can be switched to Sinhala and is remembered", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/");
    await page.getByLabel("Language").selectOption("si");
    await expect(page.getByRole("link", { name: "ඇතුළු වන්න" }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "si");
    await page.reload();
    await expect(page.getByRole("link", { name: "ඇතුළු වන්න" }).first()).toBeVisible();
  });

  test("a forgotten password can be recovered by email", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password." })).toBeVisible();
    await page.getByLabel("Email").fill("person@example.test");
    await page.getByRole("button", { name: /Send reset link/ }).click();
    await expect(page.getByText(/If an account exists for that email/)).toBeVisible();
  });

  test("account deletion needs a typed confirmation", async ({ page }) => {
    const backend = await mockBackend(page, "RENTER");
    await signIn(page);
    await page.getByRole("link", { name: "Account and privacy" }).click();
    const remove = page.getByRole("button", { name: "Delete my account" });
    await expect(remove).toBeDisabled();
    await page.getByLabel(/Type DELETE/).fill("delete");
    await expect(remove).toBeDisabled();
    await page.getByLabel(/Type DELETE/).fill("DELETE");
    await remove.click();
    await expect(page).toHaveURL(/\/$/);
    const [deleted] = backend.called("POST", "/users/me/delete");
    expect(deleted.body).toEqual({ confirm: "DELETE" });
  });

  test("a user can download their data", async ({ page }) => {
    const backend = await mockBackend(page, "RENTER");
    await signIn(page);
    await page.getByRole("link", { name: "Account and privacy" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download my data" }).click();
    expect((await download).suggestedFilename()).toBe("rentalhub-sri-lanka-my-data.json");
    expect(backend.called("GET", "/users/me/export")).toHaveLength(1);
  });
});

test.describe("renters", () => {
  test("can submit a private request", async ({ page }) => {
    const backend = await mockBackend(page, "RENTER");
    await signIn(page);
    await page.getByRole("link", { name: "Find a home" }).first().click();

    await page.getByLabel(/Preferred areas/).fill("Colombo 5, Nugegoda");
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByLabel(/Maximum budget/).fill("100000");
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByLabel(/WhatsApp mobile number/).fill("71 234 5678");
    await page.getByRole("button", { name: /Send private request/ }).click();

    await expect(page.getByRole("heading", { name: "Your search is in good hands." })).toBeVisible();
    const [submitted] = backend.called("POST", "/requests");
    expect(submitted.body).toMatchObject({ areaText: "Colombo 5, Nugegoda", budgetMax: 100000, renterContact: "+94712345678" });
  });

  test("is stopped by validation before anything is sent", async ({ page }) => {
    const backend = await mockBackend(page, "RENTER");
    await signIn(page);
    await page.getByRole("link", { name: "Find a home" }).first().click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(backend.called("POST", "/requests")).toHaveLength(0);
  });
});

test.describe("owners", () => {
  test("can add a property through the three-step form", async ({ page }) => {
    const backend = await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByRole("link", { name: "List a rental" }).click();
    await page.getByRole("link", { name: /Homes & apartments/ }).click();

    await expect(page.getByRole("heading", { name: "Physical specifications" })).toBeVisible();
    await page.getByLabel(/^Area/).fill("Nugegoda");
    await page.getByRole("button", { name: /Continue to rent/ }).click();

    await expect(page.getByRole("heading", { name: "Rent, terms & contact" })).toBeVisible();
    await page.getByLabel(/Monthly rent/).fill("85000");
    await page.getByLabel(/Contact phone number/).fill("71 234 5678");
    await page.getByRole("button", { name: /Continue to photos/ }).click();

    await expect(page.getByRole("heading", { name: "Photos & submission" })).toBeVisible();
    await page.getByRole("button", { name: /Submit for approval/ }).click();

    await expect(page.getByText("Your property has been submitted.")).toBeVisible();
    const [created] = backend.called("POST", "/listings");
    expect(created.body).toMatchObject({ areaText: "Nugegoda", monthlyRent: 85000, ownerContact: "+94712345678" });
  });

  test("cannot leave the first step with a missing area", async ({ page }) => {
    const backend = await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByRole("link", { name: "List a rental" }).click();
    await page.getByRole("link", { name: /Homes & apartments/ }).click();
    await page.getByRole("button", { name: /Continue to rent/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Please check your listing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Physical specifications" })).toBeVisible();
    expect(backend.called("POST", "/listings")).toHaveLength(0);
  });
});

test.describe("administrators", () => {
  test("land on the console and can approve a pending listing", async ({ page }) => {
    const backend = await mockBackend(page, "ADMIN");
    await signIn(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();

    await page.getByRole("link", { name: "Listings", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Listings", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve listing" }).click();
    await expect.poll(() => backend.called("PATCH", "/listings/22222222-2222-4222-8222-222222222222/approve").length).toBe(1);
  });

  test("match cards start collapsed, expand on demand, and send you to the reason field when one is required", async ({ page }) => {
    const backend = await mockBackend(page, "ADMIN");
    await signIn(page);
    await page.getByRole("link", { name: "Rental requests" }).first().click();
    await page.getByRole("button", { name: "Review request" }).click();
    await page.getByRole("button", { name: "Find potential matches" }).click();

    const best = page.locator(".match-suggestion", { hasText: "SL-000101" });
    const risky = page.locator(".match-suggestion", { hasText: "SL-000102" });
    await expect(best).toBeVisible();
    // Collapsed: triage information and actions only, no contact details or criteria list.
    await expect(best).toContainText("92%");
    await expect(best).toContainText("3 matched");
    await expect(risky).toContainText("Needs a reason");
    await expect(best.getByRole("button", { name: "Save match" })).toBeVisible();
    await expect(best.getByRole("button", { name: "Copy message" })).toBeVisible();
    await expect(page.getByText("Owner contact (admin only)")).toHaveCount(0);
    await expect(best.locator("button[aria-expanded]")).toHaveAttribute("aria-expanded", "false");

    // Expanding one reveals only that card's details.
    await best.locator("button[aria-expanded]").click();
    await expect(best.getByText("Owner contact (admin only)")).toBeVisible();
    await expect(best.getByText("Area matched exactly.")).toBeVisible();
    await expect(risky.getByText("Owner contact (admin only)")).toHaveCount(0);

    // Saving a match that needs a reason opens the card and focuses the reason box instead of failing silently.
    await risky.getByRole("button", { name: "Save match" }).click();
    const reason = risky.getByLabel(/Recommendation reason/);
    await expect(reason).toBeVisible();
    await expect(reason).toBeFocused();
    expect(backend.called("POST", "/matching/requests/55555555-5555-4555-8555-555555555555/suggestions")).toHaveLength(0);

    // Expand all and Collapse all work across the whole page, and what you typed is kept.
    await reason.fill("Renter agreed to a higher budget.");
    await page.getByRole("button", { name: "Collapse all" }).click();
    await expect(page.getByText("Owner contact (admin only)")).toHaveCount(0);
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(page.getByText("Owner contact (admin only)")).toHaveCount(2);
    await expect(risky.getByLabel(/Recommendation reason/)).toHaveValue("Renter agreed to a higher budget.");
  });

  test("see the admin menu only when they have permission", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await signIn(page);
    await expect(page.getByRole("link", { name: "Admin dashboard" })).toHaveCount(0);
  });
});

test.describe("item rentals", () => {
  const colombo = (daysAhead: number) => {
    const date = new Date(Date.now() + daysAhead * 86_400_000);
    return date.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  };

  test("the home page offers every category and each tile leads somewhere", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/categories");
    for (const name of ["Homes & apartments", "Vehicles", "Tools & equipment", "Event gear"])
      await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByRole("link", { name: /Homes & apartments/ })).toHaveAttribute("href", "/listings");
    await expect(page.getByRole("link", { name: /Vehicles/ })).toHaveAttribute("href", "/c/vehicles");
    await expect(page.getByRole("link", { name: /Tools & equipment/ })).toHaveAttribute("href", "/c/equipment");
    await expect(page.getByRole("link", { name: /Event gear/ })).toHaveAttribute("href", "/c/event-gear");
    await page.getByRole("link", { name: /Vehicles/ }).click();
    await expect(page).toHaveURL(/\/c\/vehicles$/);
    await expect(page.getByRole("link", { name: /Toyota Aqua/ })).toBeVisible();
  });

  test("filters are sent to the API when browsing a category", async ({ page }) => {
    const backend = await mockBackend(page, "RENTER");
    await page.goto("/c/vehicles");
    await page.getByLabel("Type").selectOption("CAR");
    await page.getByLabel("Max price (LKR)").fill("8000");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect.poll(() => backend.calls.filter((call) => call.path === "/listings").at(-1)?.query.get("subtype")).toBe("CAR");
    const last = backend.calls.filter((call) => call.path === "/listings").at(-1);
    expect(last?.query.get("category")).toBe("VEHICLE");
    expect(last?.query.get("maxRent")).toBe("8000");
  });

  test("a renter picks dates, sees the price and is sent to PayHere to pay", async ({ page }) => {
    const backend = await mockBackend(page, "RENTER");
    await page.route("https://sandbox.payhere.lk/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>PayHere</h1>" }));
    await signIn(page);
    await page.getByRole("link", { name: "Browse rentals" }).click();
    await page.getByRole("link", { name: /Vehicles/ }).click();
    await page.getByRole("link", { name: /Toyota Aqua/ }).click();

    await expect(page).toHaveURL(new RegExp(`/item/${ITEM_ID}$`));
    await expect(page.getByRole("heading", { name: "Toyota Aqua" })).toBeVisible();
    await expect(page.getByText("Automatic")).toBeVisible();
    await page.getByLabel("From").fill(colombo(7));
    await page.getByLabel("Until (return date)").fill(colombo(10));
    await expect(page.getByText("LKR 26,500")).toBeVisible();
    await page.getByLabel("Your mobile number").fill("71 234 5678");

    const payhere = page.waitForRequest((request) => request.url().includes("sandbox.payhere.lk") && request.method() === "POST");
    await page.getByRole("button", { name: "Book and pay" }).click();
    expect((await payhere).postData()).toContain(`order_id=${BOOKING_ID}`);

    const [booking] = backend.called("POST", "/bookings");
    expect(booking.body).toMatchObject({ listingId: "66666666-6666-4666-8666-666666666666", startDate: colombo(7), endDate: colombo(10), renterContact: "+94712345678" });
    expect(backend.called("POST", `/bookings/${BOOKING_ID}/checkout`)).toHaveLength(1);
  });

  test("an owner lists a vehicle from fields the API defines", async ({ page }) => {
    const backend = await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByRole("link", { name: "List a rental" }).click();
    await page.getByRole("link", { name: /Vehicles/ }).click();

    await page.getByLabel("Title").fill("Toyota Aqua");
    await page.getByLabel("Vehicle type").selectOption("CAR");
    await page.getByLabel("Transmission").selectOption("AUTOMATIC");
    await page.getByLabel("Fuel").selectOption("HYBRID");
    await page.getByLabel("Seats").fill("5");
    await page.getByLabel("Pickup area").fill("Galle");
    await page.getByLabel("Price (LKR)").fill("5000");
    await page.getByLabel("Your mobile number").fill("71 234 5678");
    await page.getByRole("button", { name: /Submit for approval/ }).click();

    await expect(page.getByText("Your listing has been submitted.")).toBeVisible();
    const [created] = backend.called("POST", "/listings/items");
    expect(created.body).toMatchObject({
      category: "VEHICLE", title: "Toyota Aqua", areaText: "Galle", rate: 5000, ratePeriod: "DAY", ownerContact: "+94712345678",
      attributes: { vehicleType: "CAR", transmission: "AUTOMATIC", fuel: "HYBRID", seats: 5, withDriver: false },
    });
  });

  test("a renter sees their bookings and can pay one that is still held", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await signIn(page);
    await page.getByText("My activity").click();
    await page.getByRole("link", { name: "Item bookings" }).click();
    await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
    await expect(page.getByText("Waiting for payment")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay now" })).toBeVisible();
  });

  test("a renter sees what a cancellation refunds before confirming it", async ({ page }) => {
    const backend = await mockBackend(page, "RENTER");
    await signIn(page);
    await page.getByText("My activity").click();
    await page.getByRole("link", { name: "Item bookings" }).click();
    const card = page.locator(".booking-card", { hasText: "Confirmed" });
    await expect(card.getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", "https://wa.me/94770000000");
    await card.getByRole("button", { name: "Cancel booking" }).click();
    await expect(card.getByText("You are cancelling well ahead, so you get everything back.")).toBeVisible();
    await expect(card.getByText("You will be refunded LKR 26,500.")).toBeVisible();
    expect(backend.called("PATCH", `/bookings/${CONFIRMED_ID}/cancel`)).toHaveLength(0);

    await card.getByRole("button", { name: "Keep booking" }).click();
    await card.getByRole("button", { name: "Cancel booking" }).click();
    await card.getByRole("button", { name: "Yes, cancel booking" }).click();
    await expect.poll(() => backend.called("PATCH", `/bookings/${CONFIRMED_ID}/cancel`).length).toBe(1);
  });

  test("an owner cancels a paid booking only with a reason", async ({ page }) => {
    const backend = await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByText("My activity").click();
    await page.getByRole("link", { name: "Bookings for my items" }).click();
    await expect(page.getByText("+94771234567")).toBeVisible();
    await page.getByRole("button", { name: "Cancel booking" }).click();
    const confirm = page.getByRole("button", { name: "Cancel and refund the renter" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Reason shown to the renter").fill("The car broke down");
    await confirm.click();
    await expect.poll(() => backend.called("PATCH", `/bookings/${CONFIRMED_ID}/owner-cancel`).length).toBe(1);
    expect(backend.called("PATCH", `/bookings/${CONFIRMED_ID}/owner-cancel`)[0].body).toEqual({ reason: "The car broke down" });
  });

  test("an owner edits a listing and only the changed fields are sent", async ({ page }) => {
    const backend = await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByText("My activity").click();
    await page.getByRole("link", { name: "My listings" }).click();
    await page.locator(".owner-property-card", { hasText: "Toyota Aqua" }).getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: /Edit listing/ })).toBeVisible();

    // Price only: applies at once, so the listing is not sent back for review.
    await page.getByLabel("Price (LKR)").fill("6500");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    const [priceEdit] = backend.called("PATCH", `/listings/${ITEM_ID}`);
    expect(priceEdit.body).toEqual({ rate: 6500 });

    // A description change is reviewed again.
    await page.getByLabel("Description (optional)").fill("Newly serviced, with child seat.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved. Your listing will be checked again before it is shown.")).toBeVisible();
    expect(backend.called("PATCH", `/listings/${ITEM_ID}`)[1].body).toMatchObject({ description: "Newly serviced, with child seat." });
  });

  test("an owner can remove a single photo and only the photo list is sent", async ({ page }) => {
    const backend = await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByText("My activity").click();
    await page.getByRole("link", { name: "My listings" }).click();
    await page.locator(".owner-property-card", { hasText: "Toyota Aqua" }).getByRole("link", { name: "Edit" }).click();
    const photos = page.locator(".photo-edit-row");
    await expect(photos.getByRole("button", { name: "Remove" })).toHaveCount(2);
    await photos.getByRole("button", { name: "Remove" }).first().click();
    await expect(photos.getByRole("button", { name: "Remove" })).toHaveCount(1);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect.poll(() => backend.called("PATCH", `/listings/${ITEM_ID}`).length).toBe(1);
    expect(backend.called("PATCH", `/listings/${ITEM_ID}`)[0].body).toEqual({ photoUrls: ["https://images.example.org/aqua-2.jpg"] });
  });

  test("an owner blocks and unblocks dates on their calendar", async ({ page }) => {
    const backend = await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByText("My activity").click();
    await page.getByRole("link", { name: "My listings" }).click();
    await page.locator(".owner-property-card", { hasText: "Toyota Aqua" }).getByRole("link", { name: "Edit" }).click();
    await expect(page.getByText("Family trip", { exact: false })).toBeVisible();

    const start = new Date(Date.now() + 50 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
    const end = new Date(Date.now() + 52 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
    await page.getByLabel("From").fill(start);
    await page.getByLabel("Until (return date)").fill(end);
    await page.getByRole("button", { name: "Block these dates" }).click();
    await expect.poll(() => backend.called("POST", `/listings/${ITEM_ID}/blocks`).length).toBe(1);
    expect(backend.called("POST", `/listings/${ITEM_ID}/blocks`)[0].body).toMatchObject({ startDate: start, endDate: end });

    await page.locator(".block-list").getByRole("button", { name: "Remove" }).click();
    await expect.poll(() => backend.calls.filter((call) => call.method === "DELETE").length).toBe(1);
  });

  test("the team records a refund once it has been sent", async ({ page }) => {
    const backend = await mockBackend(page, "ADMIN");
    await signIn(page);
    await page.getByRole("link", { name: "Bookings", exact: true }).click();
    await page.getByRole("button", { name: "Refunds due" }).click();
    await page.getByText("Record refund").click();
    await expect(page.getByText(/Refund LKR 26,500 to the renter/)).toBeVisible();
    await page.getByLabel(/PayHere refund reference/).fill("RF-77");
    await page.getByRole("button", { name: "I have sent this refund" }).click();
    await expect.poll(() => backend.called("PATCH", `/bookings/${CONFIRMED_ID}/refund-done`).length).toBe(1);
    expect(backend.called("PATCH", `/bookings/${CONFIRMED_ID}/refund-done`)[0].body).toEqual({ reference: "RF-77" });
  });
});
