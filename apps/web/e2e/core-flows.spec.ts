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
    expect((await download).suggestedFilename()).toBe("sewana-lanka-my-data.json");
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

  test("see the admin menu only when they have permission", async ({ page }) => {
    await mockBackend(page, "RENTER");
    await signIn(page);
    await expect(page.getByRole("link", { name: "Admin dashboard" })).toHaveCount(0);
  });
});
