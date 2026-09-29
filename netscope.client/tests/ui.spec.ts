import { test, expect } from "@playwright/test";
import type { Page, APIRequestContext } from "@playwright/test";

const password = "NetScopeDemo!2026";
const admin = { email: "admin@netscope.local", password };
type Account = { user: { id: string; email: string } };
let accounts: string[] = [];

async function register(request: APIRequestContext) {
  const email = `ui-${crypto.randomUUID()}@example.test`;
  const response = await request.post("/api/auth/register", {
    data: { email, password },
  });
  expect(response.status()).toBe(201);
  const account: Account = await response.json();
  accounts.push(account.user.id);
  return account;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("El. paštas", { exact: true }).fill(email);
  await page.getByLabel("Slaptažodis", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Prisijungti", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tinklo apžvalga", exact: true }),
  ).toBeVisible();
}

async function menu(page: Page, name: string) {
  const toggle = page.getByRole("button", { name: "Atidaryti meniu" });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .getByRole("navigation", { name: "Pagrindinis meniu" })
    .getByRole("link", { name, exact: true })
    .click();
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test.beforeEach(() => {
  accounts = [];
});
test.afterEach(async ({ request }) => {
  if (!accounts.length) return;
  const response = await request.post("/api/auth/login", { data: admin });
  expect(response.ok()).toBeTruthy();
  for (const id of accounts) {
    const deletion = await request.delete(`/api/users/${id}`);
    expect([204, 404]).toContain(deletion.status());
  }
  await request.post("/api/auth/logout");
});

test("registration validation, session reload and logout", async ({ page }) => {
  await page.goto("/register");
  const email = `ui-${crypto.randomUUID()}@example.test`;
  await page.getByLabel("El. paštas", { exact: true }).fill(email);
  await page.getByLabel("Slaptažodis", { exact: true }).fill(password);
  await page.getByLabel("Pakartokite slaptažodį").fill("Different!2026");
  await page.getByRole("button", { name: "Sukurti paskyrą" }).click();
  await expect(page.getByText("Slaptažodžiai nesutampa.")).toBeVisible();
  await page.getByLabel("Pakartokite slaptažodį").fill(password);
  const registered = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/register") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sukurti paskyrą" }).click();
  const session: Account = await (await registered).json();
  expect(session).not.toHaveProperty("accessToken");
  accounts.push(session.user.id);
  await expect(
    page.getByRole("heading", { name: "Tinklo apžvalga", exact: true }),
  ).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "netscope_access")?.httpOnly).toBe(true);
  expect(cookies.find((cookie) => cookie.name === "netscope_refresh")?.httpOnly).toBe(true);
  await page.context().addCookies([{ name: "netscope_access", value: "expired-for-test",
    url: new URL(page.url()).origin, httpOnly: true, secure: false, sameSite: "Strict" }]);
  const refreshed = page.waitForResponse((response) => response.url().endsWith("/api/auth/refresh"));
  await page.reload();
  expect((await refreshed).status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Tinklo apžvalga", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  const toggle = page.getByRole("button", { name: "Atidaryti meniu" });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole("button", { name: "Atsijungti", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sveiki sugrįžę" }),
  ).toBeVisible();
  expect((await page.context().cookies()).filter((cookie) => cookie.name.startsWith("netscope_"))).toHaveLength(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("netscope.session")),
  ).toBeNull();
});

test("location, device and client CRUD with API validation", async ({
  page,
  request,
}) => {
  const account = await register(request);
  await login(page, account.user.email);
  await menu(page, "Vietos");
  await page.getByRole("button", { name: "Nauja vieta", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Pavadinimas *").fill("UI laboratorija");
  await modal
    .getByLabel("Adresas / vietos aprašas *")
    .fill("Studentų g. 50, Kaunas");
  await modal
    .getByLabel("Papildoma informacija")
    .fill("Naršyklės integracinis bandymas.");
  await modal.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(modal).not.toBeVisible();
  await page.getByRole("link", { name: /^UI laboratorija / }).click();
  await page.getByRole("button", { name: "Redaguoti", exact: true }).click();
  await modal.getByLabel("Pavadinimas *").fill("UI laboratorija atnaujinta");
  await modal.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(
    page.getByRole("heading", { name: "UI laboratorija atnaujinta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Naujas įrenginys" }).click();
  await modal.getByLabel("Pavadinimas *").fill("UI maršrutizatorius");
  await modal.getByLabel("IP adresas *").fill("invalid-ip");
  await modal.getByLabel("MAC adresas *").fill("02:10:20:30:40:50");
  await modal.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(modal.getByRole("alert")).toBeVisible();
  await modal.getByLabel("IP adresas *").fill("10.0.0.1");
  await modal.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(modal).not.toBeVisible();
  await page
    .getByRole("link", {
      name: "UI maršrutizatorius Maršrutizatorius",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Redaguoti", exact: true }).click();
  await modal.getByLabel("Būsena *").selectOption("Maintenance");
  await modal.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Priežiūra", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Naujas klientas" }).click();
  await modal.getByLabel("Pavadinimas *").fill("UI kompiuteris");
  await modal.getByLabel("IP adresas *").fill("10.0.0.2");
  await modal.getByLabel("MAC adresas *").fill("02:10:20:30:40:51");
  await modal.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(modal).not.toBeVisible();
  await page
    .getByRole("button", { name: "UI kompiuteris Kompiuteris", exact: true })
    .click();
  await expect(modal.getByText("10.0.0.2", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Redaguoti UI kompiuteris" }).click();
  await modal.getByLabel("Pavadinimas *").fill("UI telefonas");
  await modal.getByLabel("Tipas *").selectOption("Phone");
  await modal.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(modal).not.toBeVisible();
  await page
    .getByRole("combobox", { name: "Tipas", exact: true })
    .selectOption("Computer");
  await expect(
    page.getByRole("heading", { name: "Įrašų nerasta" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Tipas", exact: true })
    .selectOption("Phone");
  await expect(
    page.getByRole("button", { name: "UI telefonas Telefonas", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "Pašalinti UI telefonas" }).click();
  await modal.getByRole("button", { name: "Taip, pašalinti" }).click();
  await expect(modal).not.toBeVisible();
  await page.getByRole("button", { name: "Pašalinti", exact: true }).click();
  await modal.getByRole("button", { name: "Taip, pašalinti" }).click();
  await expect(
    page.getByRole("heading", { name: "UI laboratorija atnaujinta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pašalinti", exact: true }).click();
  await modal.getByRole("button", { name: "Taip, pašalinti" }).click();
  await expect(
    page.getByRole("heading", { name: "Tinklo vietos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "UI laboratorija atnaujinta", exact: true }),
  ).toHaveCount(0);
});

test("read-only permissions, private clients and 404", async ({
  page,
  request,
}) => {
  const owner = await register(request);
  const reader = await register(request);
  expect((await request.post("/api/auth/login", { data: { email: owner.user.email, password } })).ok()).toBeTruthy();
  const placeResponse = await request.post("/api/locations", {
    data: { name: "Privati laboratorija", address: "Kaunas" },
  });
  const place = await placeResponse.json();
  const deviceResponse = await request.post(
    `/api/locations/${place.id}/devices`,
    {
      data: {
        name: "Privatus įrenginys",
        type: "Router",
        status: "Online",
        ipAddress: "10.1.1.1",
        macAddress: "02:00:00:00:00:01",
      },
    },
  );
  const device = await deviceResponse.json();
  await login(page, reader.user.email);
  await page.goto(`/locations/${place.id}`);
  await expect(page.getByText("Tik peržiūra", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Naujas įrenginys" }),
  ).toHaveCount(0);
  await page.goto(`/locations/${place.id}/devices/${device.id}`);
  await expect(
    page.getByRole("heading", { name: "Klientų informacija privati" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Naujas klientas" }),
  ).toHaveCount(0);
  await page.goto("/users");
  await expect(
    page.getByRole("heading", { name: "Puslapis nepasiekiamas" }),
  ).toBeVisible();
  await page.goto(`/locations/${crypto.randomUUID()}`);
  await expect(page.getByRole("alert")).toContainText("Įrašas nerastas");
});

test("administrator users, modal focus and responsive layouts", async ({
  page,
  request,
}, testInfo) => {
  const disposable = await register(request);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await login(page, admin.email);
  await expect(
    page.getByRole("heading", { name: "Įrenginių registras" }),
  ).toBeVisible();
  await noOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `../.local/ui-${testInfo.project.name}-dashboard.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Kaip naudotis" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  expect(
    await modal.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `../.local/ui-${testInfo.project.name}-modal.png`,
    fullPage: false,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kaip naudotis" }),
  ).toBeFocused();
  await menu(page, "Naudotojai");
  await page
    .getByRole("searchbox", { name: "Ieškoti naudotojų" })
    .fill(disposable.user.email);
  await page.getByRole("button", { name: "Ieškoti", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: disposable.user.email })
    .getByRole("button", { name: "Pašalinti" })
    .click();
  await modal.getByRole("button", { name: "Taip, pašalinti" }).click();
  await expect(
    page.getByRole("heading", { name: "Naudotojų nerasta" }),
  ).toBeVisible();
  await noOverflow(page);
  expect(failures).toEqual([]);
  const wireframes = await request.get("/wireframes.html");
  expect(wireframes.status()).toBe(200);
  expect(await wireframes.text()).toContain("wireframe");
  const loginPage = await request.get("/login");
  expect(loginPage.status()).toBe(200);
  expect(await loginPage.text()).toContain("<div id=\"root\"></div>");
  expect((await request.get("/api/not-a-route")).status()).toBe(404);
});
