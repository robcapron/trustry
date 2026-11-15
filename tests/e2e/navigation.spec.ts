import { expect, test } from "@playwright/test";

test("l'accueil ouvre le Dashboard du premier espace", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sdg-distribution\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Robin.");
});

test("le Dashboard affiche KPI, canaux, alertes, piliers et SKU", async ({ page }) => {
  await page.goto("/sdg-distribution/dashboard");
  await expect(page.getByText("Profit net du mois")).toBeVisible();
  await expect(page.getByText(/^vs \d/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Par canal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "À traiter en priorité" })).toBeVisible();
  await expect(page.getByText("12 références ACTA bloquées sur Amazon DE")).toBeVisible();
  await expect(page.getByText("Score global")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Flop 5 SKU" })).toBeVisible();
  await page.getByRole("link", { name: "7 jours" }).click();
  await expect(page).toHaveURL(/periode=7j/);
  await expect(page.getByText("Profit net sur 7 jours")).toBeVisible();
});

test("le changement d'espace garde la même page", async ({ page, isMobile }) => {
  await page.goto("/sdg-distribution/alertes");
  await page.getByRole("button", { name: /Espace client/ }).first().click();
  await page.getByRole("menuitem", { name: /Alpenrad/ }).click();
  await expect(page).toHaveURL(/\/alpenrad\/alertes$/);
  if (!isMobile) await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
});

test("Import OMS est réservé à l'espace SDG", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "Import OMS est un usage ordinateur");
  await page.goto("/sdg-distribution/dashboard");
  await page.getByRole("link", { name: "Import OMS" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Import OMS");
  await expect(page.frameLocator("iframe").getByText("Glisse ici tes CSV du jour")).toBeVisible();

  expect((await request.get("/kraken-surf/import-oms/outil")).status()).toBe(404);
  await page.goto("/kraken-surf/dashboard");
  await expect(page.getByRole("link", { name: "Import OMS" })).toHaveCount(0);
});

test("la navigation des piliers et les badges fonctionnent", async ({ page, isMobile }) => {
  await page.goto("/sdg-distribution/dashboard");
  if (isMobile) {
    await page.getByRole("navigation", { name: "Navigation mobile" }).getByRole("link", { name: /Piliers/ }).click();
    await page.getByRole("link", { name: /Intégration produits/ }).click();
  } else {
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link", { name: /Alertes/ })).toContainText("7");
    await expect(nav.getByRole("link", { name: /Intégration produits/ })).toContainText("29");
    await nav.getByRole("link", { name: /Intégration produits/ }).click();
  }
  await expect(page).toHaveURL(/\/piliers\/integration$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Intégration produits");
});

test("un espace inconnu affiche une page introuvable", async ({ page }) => {
  await page.goto("/espace-inexistant/dashboard");
  await expect(page.getByText("Espace ou page introuvable")).toBeVisible();
});

test("aucun tiret long dans les pages rendues", async ({ page }) => {
  for (const path of ["/sdg-distribution/dashboard", "/sdg-distribution/parametres/connecteurs", "/sdg-distribution/design-system"]) {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    expect(text, path).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
  }
});
