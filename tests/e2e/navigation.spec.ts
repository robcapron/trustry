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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Import OMS/);
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

test("P&L : canal > pays > SKU, filtres et export CSV", async ({ page, isMobile }) => {
  await page.goto("/sdg-distribution/pnl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("P&L détaillé");
  await expect(page.getByRole("rowheader", { name: /Amazon UE/ })).toBeVisible();
  await page.getByRole("button", { name: "Déplier Amazon UE" }).click();
  await expect(page.getByRole("rowheader", { name: /(^| )FR$/ }).first()).toBeVisible();
  if (!isMobile) {
    await page.getByRole("button", { name: "Déplier FR" }).first().click();
    await expect(page.getByText("ACTA-HLM-ADV-BLK-M").first()).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Exporter en CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^pnl-sdg-distribution-.*\.csv$/);
  }
  await page.getByLabel("Canal").selectOption("decathlon");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/canal=decathlon/);
  await expect(page.getByRole("rowheader", { name: /Amazon UE/ })).toHaveCount(0);
});

test("Centre d'alertes : priorité, filtres et changement de statut", async ({ page }) => {
  await page.goto("/sdg-distribution/alertes");
  const first = page.locator("li[id^=alerte-]").first();
  await expect(first).toContainText("Référence bloquée");
  await page.getByRole("link", { name: /Infos/ }).click();
  await expect(page.locator("li[id^=alerte-]")).toHaveCount(1);
  await expect(page.locator("li[id^=alerte-]").first()).toContainText("Synchro Allegro en retard");
  const card = page.locator("li[id^=alerte-]").first();
  await card.getByRole("button", { name: "En cours" }).click();
  await expect(card.getByRole("button", { name: "En cours" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "À traiter" }).click();
  await expect(card.getByRole("button", { name: "À traiter" })).toHaveAttribute("aria-pressed", "true");
});

test("Utilisateurs : l'accès Import OMS se règle membre par membre", async ({ page, isMobile }) => {
  test.skip(isMobile, "réglage d'administration fait sur ordinateur");
  await page.goto("/sdg-distribution/parametres/utilisateurs");
  const lea = page.getByRole("switch", { name: "Accès Import OMS pour Léa Morel" });
  await expect(lea).toHaveAttribute("aria-checked", "false");
  await lea.click();
  await expect(page.getByRole("switch", { name: "Accès Import OMS pour Léa Morel" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("switch", { name: "Accès Import OMS pour Léa Morel" }).click();
  await expect(page.getByRole("switch", { name: "Accès Import OMS pour Léa Morel" })).toHaveAttribute("aria-checked", "false");
});

test("revue mensuelle : 4 pôles et 13 mois", async ({ page }) => {
  await page.goto("/sdg-distribution/revue-mensuelle");
  await expect(page.getByRole("heading", { name: "Revue mensuelle" })).toBeVisible();
  for (const pole of ["Acquisition", "Retours", "Logistique", "Frais internes"]) {
    await expect(page.getByRole("heading", { name: pole, exact: true })).toBeVisible();
  }
  await expect(page.getByText("TACoS").first()).toBeVisible();
  const rows = page.locator("table").first().locator("tbody tr");
  await expect(rows).toHaveCount(13);
});

test("forecast : atterrissage fin de mois et objectif modifiable", async ({ page }, info) => {
  await page.goto("/sdg-distribution/dashboard");
  await expect(page.getByRole("heading", { name: /^Atterrissage fin / })).toBeVisible();
  await expect(page.getByText(/fourchette/)).toBeVisible();
  await page.goto("/sdg-distribution/dashboard?periode=trimestre");
  await expect(page.getByRole("heading", { name: /^Atterrissage fin T\d \d{4}$/ })).toBeVisible();
  test.skip(info.project.name !== "desktop", "saisie testée sur desktop");
  await page.goto("/sdg-distribution/parametres/espace");
  await page.getByLabel("Objectif de CA HT du mois").fill("500 000");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Objectifs enregistrés.")).toBeVisible();
  await page.goto("/sdg-distribution/dashboard");
  await expect(page.getByText(/Objectif\s+500\s000\s€/)).toBeVisible();
  await expect(page.getByText("Sous l'objectif")).toBeVisible();
});
