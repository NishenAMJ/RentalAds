import { expect, test } from "@playwright/test";
import { mockBackend, signIn } from "./support/mock-backend";

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
  const HEADLINE = /A place to live\.\s*A little help finding it\./;

  test("has no illustration and types the headline, then shows the buttons", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/");
    await expect(page.locator(".hero-art")).toHaveCount(0);
    // Assistive technology and search engines get the complete headline straight away, before any typing.
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeAttached();
    // The buttons wait until the text is in place.
    const buttons = page.locator(".hero-reveal");
    await expect(buttons).toHaveAttribute("data-pending", "true");
    await expect(page.locator("h1 .tw-live")).toHaveText(HEADLINE, { timeout: 15000 });
    await expect(page.locator(".intro .tw-live")).toContainText("Our local team brings together your needs", { timeout: 15000 });
    await expect(buttons).toHaveAttribute("data-pending", "false");
    await expect(page.getByRole("link", { name: /Find a property for me/ }).first()).toBeVisible();
    await expect(page.locator(".tw-cursor")).toHaveCount(0);
  });

  test("types again after a refresh, but not when you return to Home without reloading", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await page.goto("/");
    await expect(page.locator(".hero-reveal")).toHaveAttribute("data-pending", "false", { timeout: 15000 });

    // Leaving and coming back inside the app shows the finished text straight away.
    await page.getByRole("link", { name: "Explore homes" }).first().click();
    await expect(page).toHaveURL(/\/listings/);
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
    await expect(page.locator("h1 .tw-live")).toContainText("ජීවත් වීමට තැනක්");
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
    await expect(page.getByRole("link", { name: "නිවාස බලන්න" }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "si");
    await page.reload();
    await expect(page.getByRole("link", { name: "නිවාස බලන්න" }).first()).toBeVisible();
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
    await page.getByRole("link", { name: "Find a property for me" }).first().click();

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
    await page.getByRole("link", { name: "Find a property for me" }).first().click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(backend.called("POST", "/requests")).toHaveLength(0);
  });
});

test.describe("owners", () => {
  test("can add a property through the three-step form", async ({ page }) => {
    const backend = await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByRole("link", { name: "For owners" }).click();

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
    await page.getByRole("link", { name: "For owners" }).click();
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
    await expect(page.getByRole("heading", { name: "Your platform at a glance." })).toBeVisible();

    await page.getByRole("link", { name: "Pending listings" }).first().click();
    await expect(page.getByRole("heading", { name: /Pending listings/ })).toBeVisible();
    await page.getByRole("button", { name: "Approve listing" }).click();
    await expect.poll(() => backend.called("PATCH", "/listings/22222222-2222-4222-8222-222222222222/approve").length).toBe(1);
  });

  test("match cards start collapsed, expand on demand, and send you to the reason field when one is required", async ({ page }) => {
    const backend = await mockBackend(page, "ADMIN");
    await signIn(page);
    await page.getByRole("link", { name: "Rental requests" }).first().click();
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
