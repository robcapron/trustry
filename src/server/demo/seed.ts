/**
 * Données d'exemple réalistes (3 espaces clients, ~190 jours d'historique).
 * Utilisées par le mode démo ET par le script de seed Supabase (mêmes identifiants).
 * Le mois en cours de l'espace SDG est calibré sur la maquette Dashboard global
 * (CA HT par canal et évolutions vs mois précédent).
 *
 * Rappel : aucun tiret long ni demi-cadratin dans les textes (vérifié par les tests).
 */
import type { Role } from "@/domain/access";
import type { AlertCategory, Severity } from "@/domain/alerts";
import { MARKETPLACES } from "@/domain/marketplaces";
import { hashString, mulberry32, stableUuid } from "./random";
import type {
  Alert,
  Connection,
  ConnectionStatus,
  DailyMetric,
  Listing,
  MarketplaceCode,
  PillarScore,
  Product,
  Store,
} from "../types";

export const DEMO_USER = {
  id: stableUuid("user:robin"),
  email: "robin@demo.trustry.app",
  fullName: "Robin Capron",
};

type DemoUser = { id: string; email: string; fullName: string };

const USERS: DemoUser[] = [
  DEMO_USER,
  { id: stableUuid("user:camille"), email: "camille@demo.trustry.app", fullName: "Camille Durand" },
  { id: stableUuid("user:lea"), email: "lea@demo.trustry.app", fullName: "Léa Morel" },
];

export { MARKETPLACES, MARKETPLACE_ORDER } from "@/domain/marketplaces";

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  PL: "PLN",
  SE: "SEK",
  US: "USD",
  JP: "JPY",
  AU: "AUD",
  CZ: "CZK",
  CH: "CHF",
  GB: "GBP",
};

const COUNTRY_WEIGHT: Partial<Record<MarketplaceCode, Record<string, number>>> = {
  amazon_eu: { FR: 0.38, DE: 0.3, IT: 0.1, ES: 0.1, NL: 0.05, BE: 0.03, PL: 0.02, SE: 0.02 },
  amazon_jp_au: { JP: 0.6, AU: 0.4 },
  decathlon: { FR: 0.62, DE: 0.12, ES: 0.12, IT: 0.09, BE: 0.05 },
  kaufland: { DE: 0.85, CZ: 0.1, SK: 0.05 },
  bol: { NL: 0.75, BE: 0.25 },
  ebay: { FR: 0.4, DE: 0.35, IT: 0.15, ES: 0.1 },
  tiktok_shop: { FR: 0.5, DE: 0.2, ES: 0.15, IT: 0.15 },
};

/** Structure de coûts par canal, en % du CA HT. Le coût d'achat est déduit pour viser la marge cible. */
const CHANNEL_COSTS: Record<MarketplaceCode, { commission: number; ads: number; logistics: number; returns: number }> = {
  amazon_eu: { commission: 15, ads: 8.5, logistics: 9, returns: 2.5 },
  amazon_us: { commission: 15, ads: 9, logistics: 12, returns: 3 },
  amazon_jp_au: { commission: 12, ads: 4, logistics: 14, returns: 2 },
  decathlon: { commission: 14, ads: 3, logistics: 8, returns: 3 },
  kaufland: { commission: 12.5, ads: 3, logistics: 9, returns: 2.5 },
  bol: { commission: 13, ads: 6, logistics: 10, returns: 3 },
  cdiscount: { commission: 14, ads: 4, logistics: 9, returns: 3.5 },
  ebay: { commission: 11, ads: 2.5, logistics: 9, returns: 2 },
  allegro: { commission: 10, ads: 2, logistics: 11, returns: 2 },
  tiktok_shop: { commission: 8, ads: 9, logistics: 9, returns: 4 },
  alltricks: { commission: 13, ads: 1.5, logistics: 8, returns: 2 },
};

type ProductSeed = { sku: string; brand: string; title: string; price: number; weight: number };

const SDG_PRODUCTS: ProductSeed[] = [
  { sku: "ACTA-HLM-ADV-BLK-M", brand: "ACTA", title: "Casque ACTA Advance Noir M", price: 74.9, weight: 10 },
  { sku: "ACTA-HLM-ADV-BLK-L", brand: "ACTA", title: "Casque ACTA Advance Noir L", price: 74.9, weight: 6 },
  { sku: "ACTA-HLM-ADV-WHT-M", brand: "ACTA", title: "Casque ACTA Advance Blanc M", price: 74.9, weight: 4 },
  { sku: "ACTA-HLM-URB-GRY-M", brand: "ACTA", title: "Casque ACTA Urban Gris M", price: 49.9, weight: 4 },
  { sku: "ACTA-HLM-KID-BLU-S", brand: "ACTA", title: "Casque ACTA Kids Bleu S", price: 34.9, weight: 3 },
  { sku: "ACTA-LCK-U-180", brand: "ACTA", title: "Antivol ACTA U 180 mm", price: 39.9, weight: 3 },
  { sku: "ACTA-HLM-ADV-BLK-S", brand: "ACTA", title: "Casque ACTA Advance Noir S", price: 74.9, weight: 2.5 },
  { sku: "ACTA-HLM-ADV-BLK-XL", brand: "ACTA", title: "Casque ACTA Advance Noir XL", price: 74.9, weight: 1.5 },
  { sku: "ACTA-HLM-ADV-WHT-L", brand: "ACTA", title: "Casque ACTA Advance Blanc L", price: 74.9, weight: 2 },
  { sku: "ACTA-HLM-URB-GRY-L", brand: "ACTA", title: "Casque ACTA Urban Gris L", price: 49.9, weight: 2 },
  { sku: "ACTA-HLM-URB-BLK-M", brand: "ACTA", title: "Casque ACTA Urban Noir M", price: 49.9, weight: 2.5 },
  { sku: "ACTA-HLM-KID-PNK-S", brand: "ACTA", title: "Casque ACTA Kids Rose S", price: 34.9, weight: 2 },
  { sku: "SIXTEN-KNP-PRO-L", brand: "SIXTEN", title: "Genouillères SIXTEN Pro L", price: 44.9, weight: 8 },
  { sku: "SIXTEN-KNP-PRO-M", brand: "SIXTEN", title: "Genouillères SIXTEN Pro M", price: 44.9, weight: 6 },
  { sku: "SIXTEN-GLV-WIN-S", brand: "SIXTEN", title: "Gants SIXTEN Winter S", price: 29.9, weight: 5 },
  { sku: "SIXTEN-GLV-WIN-M", brand: "SIXTEN", title: "Gants SIXTEN Winter M", price: 29.9, weight: 5 },
  { sku: "SIXTEN-ELB-PRO-M", brand: "SIXTEN", title: "Coudières SIXTEN Pro M", price: 32.9, weight: 3 },
  { sku: "SIXTEN-WRS-PRO-M", brand: "SIXTEN", title: "Protège-poignets SIXTEN Pro M", price: 24.9, weight: 3 },
  { sku: "TSG-PASS-SLD-M", brand: "TSG", title: "Casque TSG Pass Solid M", price: 189.9, weight: 5 },
  { sku: "TSG-PASS-SLD-L", brand: "TSG", title: "Casque TSG Pass Solid L", price: 189.9, weight: 3 },
  { sku: "TSG-EVO-SLD-M", brand: "TSG", title: "Casque TSG Evolution Solid M", price: 54.9, weight: 4 },
  { sku: "TSG-KNEE-FORCE-M", brand: "TSG", title: "Genouillères TSG Force M", price: 39.9, weight: 3 },
  { sku: "LOADED-TESS-39", brand: "LOADED", title: "Longboard Loaded Tesseract 39", price: 299.0, weight: 4 },
  { sku: "LOADED-ICARUS-38", brand: "LOADED", title: "Longboard Loaded Icarus 38", price: 329.0, weight: 2 },
  { sku: "LOADED-CHUBBY-30", brand: "LOADED", title: "Cruiser Loaded Chubby Unicorn 30", price: 249.0, weight: 2 },
  { sku: "ORNG-KEGEL-80A", brand: "ORANGATANG", title: "Roues Orangatang Kegel 80a", price: 59.9, weight: 6 },
  { sku: "ORNG-INHEAT-77A", brand: "ORANGATANG", title: "Roues Orangatang In Heat 77a", price: 49.9, weight: 4 },
  { sku: "ORNG-STIMULUS-70", brand: "ORANGATANG", title: "Roues Orangatang Stimulus 70 mm", price: 54.9, weight: 2 },
  { sku: "NS-ECC-LITE-29", brand: "NS BIKES", title: "Vélo NS Bikes Eccentric Lite 29", price: 1299.0, weight: 1.6 },
  { sku: "NS-MOVEMENT-3", brand: "NS BIKES", title: "Vélo NS Bikes Movement 3", price: 649.0, weight: 1.2 },
  { sku: "NS-GRIP-LOGIC", brand: "NS BIKES", title: "Poignées NS Bikes Logic", price: 14.9, weight: 2 },
  { sku: "CARVER-CX-31", brand: "CARVER", title: "Surfskate Carver CX 31", price: 249.0, weight: 3 },
  { sku: "CARVER-C7-30", brand: "CARVER", title: "Surfskate Carver C7 30", price: 259.0, weight: 2 },
  { sku: "CARVER-TRUCK-CX", brand: "CARVER", title: "Truck Carver CX 6.5", price: 79.9, weight: 2 },
  { sku: "EVS-KNEE-RS-M", brand: "EVS", title: "Genouillères EVS RS M", price: 69.9, weight: 2 },
  { sku: "EVS-KNEE-RS-L", brand: "EVS", title: "Genouillères EVS RS L", price: 69.9, weight: 1.5 },
  { sku: "SONE-LIFER-XS", brand: "S-ONE", title: "Casque S-ONE Lifer XS", price: 59.9, weight: 1.5 },
  { sku: "SONE-LIFER-M", brand: "S-ONE", title: "Casque S-ONE Lifer M", price: 59.9, weight: 2.5 },
  { sku: "BLUNT-PROS-BAR", brand: "BLUNT", title: "Guidon trottinette Blunt Prodigy", price: 54.9, weight: 2 },
  { sku: "BLUNT-WHL-120", brand: "BLUNT", title: "Roues trottinette Blunt 120 mm", price: 34.9, weight: 2.5 },
  { sku: "TRITON-GRIP-SHEET", brand: "TRITON", title: "Grip Triton Sheet", price: 12.9, weight: 2 },
  { sku: "TRITON-BRG-ABEC9", brand: "TRITON", title: "Roulements Triton ABEC 9", price: 19.9, weight: 2 },
];

type ChannelPlan = {
  marketplace: MarketplaceCode;
  status: ConnectionStatus;
  /** CA HT du mois en cours (du 1er à aujourd'hui), en euros */
  mtdRevenue: number;
  /** Évolution vs même période du mois précédent, en % */
  evolution: number;
  /** Marge nette visée, en % */
  margin: number;
  /** Part des produits du catalogue listés sur ce canal */
  coverage: number;
};

type WorkspaceSeed = {
  key: string;
  name: string;
  slug: string;
  modules: string[];
  products: ProductSeed[];
  channels: ChannelPlan[];
  members: { userKey: number; role: Role; modules?: string[] }[];
};

const SDG: WorkspaceSeed = {
  key: "sdg",
  name: "SDG Distribution",
  slug: "sdg-distribution",
  modules: ["import-oms"],
  products: SDG_PRODUCTS,
  members: [
    { userKey: 0, role: "owner" },
    { userKey: 1, role: "manager", modules: ["import-oms"] },
    { userKey: 2, role: "viewer" },
  ],
  // Valeurs de la maquette (mois en cours) ; "Autres" réparti sur Allegro, TikTok et Amazon JP / AU.
  channels: [
    { marketplace: "amazon_eu", status: "connected", mtdRevenue: 68200, evolution: 14.2, margin: 21.8, coverage: 1 },
    { marketplace: "decathlon", status: "connected", mtdRevenue: 24100, evolution: 18.5, margin: 26.1, coverage: 0.7 },
    { marketplace: "kaufland", status: "connected", mtdRevenue: 12400, evolution: -21.3, margin: 19.4, coverage: 0.6 },
    { marketplace: "bol", status: "connected", mtdRevenue: 9800, evolution: 64.0, margin: 17.2, coverage: 0.5 },
    { marketplace: "cdiscount", status: "connected", mtdRevenue: 8300, evolution: 6.1, margin: 14.9, coverage: 0.5 },
    { marketplace: "alltricks", status: "connected", mtdRevenue: 7100, evolution: 3.4, margin: 23.5, coverage: 0.45 },
    { marketplace: "ebay", status: "connected", mtdRevenue: 5600, evolution: -4.2, margin: 20.3, coverage: 0.5 },
    { marketplace: "amazon_us", status: "connected", mtdRevenue: 4200, evolution: 9.0, margin: 18.7, coverage: 0.3 },
    { marketplace: "allegro", status: "syncing", mtdRevenue: 1180, evolution: 4.0, margin: 16.5, coverage: 0.3 },
    { marketplace: "tiktok_shop", status: "error", mtdRevenue: 860, evolution: -3.0, margin: 13.0, coverage: 0.25 },
    { marketplace: "amazon_jp_au", status: "connected", mtdRevenue: 640, evolution: 5.0, margin: 18.0, coverage: 0.15 },
  ],
};

const KRAKEN: WorkspaceSeed = {
  key: "kraken",
  name: "Kraken Surf Co",
  slug: "kraken-surf",
  modules: [],
  members: [{ userKey: 0, role: "owner" }],
  products: [
    { sku: "KRK-LEASH-6-BLK", brand: "KRAKEN", title: "Leash Kraken Comp 6' Noir", price: 34.9, weight: 6 },
    { sku: "KRK-LEASH-8-BLK", brand: "KRAKEN", title: "Leash Kraken Longboard 8' Noir", price: 39.9, weight: 3 },
    { sku: "KRK-WAX-COOL", brand: "KRAKEN", title: "Wax Kraken eau froide", price: 3.9, weight: 8 },
    { sku: "KRK-WAX-WARM", brand: "KRAKEN", title: "Wax Kraken eau chaude", price: 3.9, weight: 4 },
    { sku: "KRK-FIN-THRUSTER", brand: "KRAKEN", title: "Dérives Kraken Thruster M", price: 69.9, weight: 4 },
    { sku: "KRK-BAG-6-0", brand: "KRAKEN", title: "Housse Kraken Day 6'0", price: 79.9, weight: 3 },
    { sku: "KRK-BAG-7-6", brand: "KRAKEN", title: "Housse Kraken Day 7'6", price: 89.9, weight: 2 },
    { sku: "KRK-PONCHO-BLK", brand: "KRAKEN", title: "Poncho Kraken Noir", price: 59.9, weight: 3 },
    { sku: "KRK-PAD-TRACTION", brand: "KRAKEN", title: "Pad Kraken Traction", price: 29.9, weight: 3 },
    { sku: "KRK-RACK-SOFT", brand: "KRAKEN", title: "Barres de toit souples Kraken", price: 49.9, weight: 2 },
  ],
  channels: [
    { marketplace: "amazon_eu", status: "connected", mtdRevenue: 9400, evolution: 6.0, margin: 18.5, coverage: 1 },
    { marketplace: "decathlon", status: "connected", mtdRevenue: 4100, evolution: -8.0, margin: 22.0, coverage: 0.8 },
    { marketplace: "ebay", status: "not_connected", mtdRevenue: 0, evolution: 0, margin: 0, coverage: 0 },
    { marketplace: "bol", status: "not_connected", mtdRevenue: 0, evolution: 0, margin: 0, coverage: 0 },
  ],
};

const ALPENRAD: WorkspaceSeed = {
  key: "alpenrad",
  name: "Alpenrad",
  slug: "alpenrad",
  modules: [],
  members: [
    { userKey: 0, role: "owner" },
    { userKey: 1, role: "admin" },
  ],
  products: [
    { sku: "ALP-PED-FLAT-BLK", brand: "ALPENRAD", title: "Pédales plates Alpenrad Noir", price: 49.9, weight: 5 },
    { sku: "ALP-GRIP-LOCK", brand: "ALPENRAD", title: "Poignées Alpenrad Lock-on", price: 24.9, weight: 5 },
    { sku: "ALP-SADDLE-ENDURO", brand: "ALPENRAD", title: "Selle Alpenrad Enduro", price: 59.9, weight: 3 },
    { sku: "ALP-STEM-50", brand: "ALPENRAD", title: "Potence Alpenrad 50 mm", price: 69.9, weight: 2 },
    { sku: "ALP-BAR-780", brand: "ALPENRAD", title: "Cintre Alpenrad 780 mm", price: 79.9, weight: 2 },
    { sku: "ALP-TUBE-29", brand: "ALPENRAD", title: "Chambre à air Alpenrad 29", price: 7.9, weight: 7 },
    { sku: "ALP-PUMP-MINI", brand: "ALPENRAD", title: "Mini-pompe Alpenrad", price: 29.9, weight: 4 },
    { sku: "ALP-LIGHT-SET", brand: "ALPENRAD", title: "Kit éclairage Alpenrad USB", price: 39.9, weight: 4 },
    { sku: "ALP-TOOL-16", brand: "ALPENRAD", title: "Multi-outil Alpenrad 16 fonctions", price: 24.9, weight: 3 },
    { sku: "ALP-CHAIN-12S", brand: "ALPENRAD", title: "Chaîne Alpenrad 12 vitesses", price: 44.9, weight: 3 },
    { sku: "ALP-BRAKE-PADS", brand: "ALPENRAD", title: "Plaquettes Alpenrad organiques", price: 14.9, weight: 4 },
    { sku: "ALP-BOTTLE-750", brand: "ALPENRAD", title: "Bidon Alpenrad 750 ml", price: 9.9, weight: 4 },
  ],
  channels: [
    { marketplace: "amazon_eu", status: "connected", mtdRevenue: 11800, evolution: 11.0, margin: 19.0, coverage: 1 },
    { marketplace: "kaufland", status: "connected", mtdRevenue: 3900, evolution: 2.0, margin: 17.0, coverage: 0.7 },
    { marketplace: "bol", status: "error", mtdRevenue: 2100, evolution: -12.0, margin: 15.0, coverage: 0.6 },
    { marketplace: "alltricks", status: "connected", mtdRevenue: 5200, evolution: 9.0, margin: 22.0, coverage: 0.8 },
  ],
};

const WORKSPACE_SEEDS = [SDG, KRAKEN, ALPENRAD];

export const DEMO_ORGANIZATION = { id: stableUuid("org:sdg"), name: "SDG Distribution", slug: "sdg-distribution" };

export type DemoDataset = {
  today: string;
  users: DemoUser[];
  organization: typeof DEMO_ORGANIZATION;
  workspaces: { id: string; slug: string; name: string; enabledModules: string[] }[];
  members: { workspaceId: string; userId: string; role: Role; grantedModules: string[] }[];
  connections: Connection[];
  stores: Store[];
  products: Product[];
  listings: Listing[];
  metrics: DailyMetric[];
  alerts: Alert[];
  pillarScores: PillarScore[];
  /** Frais internes mensuels (centimes), clé `${workspaceId}:${YYYY-MM}` */
  opex: Record<string, number>;
  /** Objectifs de CA HT mensuels (centimes), clé `${workspaceId}:${YYYY-MM}` */
  revenueTargets: Record<string, number>;
};

export const HISTORY_DAYS = 410;

/** Date du jour à Paris, au format YYYY-MM-DD. */
export function parisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Même jour du mois précédent (borné à la fin de mois). */
function previousMonthSameDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/** Saisonnalité mensuelle (janvier à décembre), relative. */
const SEASONALITY = [0.6, 0.6, 0.85, 0.95, 1, 1, 0.9, 0.75, 1, 1, 1.05, 1.25];

/** Variation déterministe des taux de pub, logistique et retours selon le mois (données d'exemple). */
function monthDrift(date: string, marketplace: string): { ads: number; logistics: number; returns: number } {
  const k = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) + (hashString(marketplace) % 7);
  const month = Number(date.slice(5, 7));
  const promo = month === 11 || month === 12 ? 1.35 : 1;
  return {
    ads: (1 + 0.22 * Math.sin(k * 1.3)) * promo,
    logistics: 1 + 0.1 * Math.sin(k * 0.9 + 1),
    returns: (1 + 0.18 * Math.sin(k * 1.7 + 2)) * (month === 1 ? 1.25 : 1),
  };
}

/** Black Friday : 4e vendredi de novembre (YYYY-MM-DD). */
function blackFriday(year: number): string {
  const first = new Date(Date.UTC(year, 10, 1, 12)).getUTCDay();
  return `${year}-11-${String(1 + ((5 - first + 7) % 7) + 21).padStart(2, "0")}`;
}

/** Pics d'activité : semaine avant le Black Friday, week-end du Black Friday au Cyber Monday. */
function eventFactor(d: string): number {
  const bf = blackFriday(Number(d.slice(0, 4)));
  if (d >= bf && d <= addDays(bf, 3)) return 2.4;
  if (d >= addDays(bf, -7) && d < bf) return 1.35;
  return 1;
}

/** Part de la journée en cours déjà écoulée (le jour J est partiel). */
const TODAY_FACTOR = 0.72;

export function buildDemoDataset(now: Date = new Date()): DemoDataset {
  const today = parisToday(now);
  const ds: DemoDataset = {
    today,
    users: USERS,
    organization: DEMO_ORGANIZATION,
    workspaces: [],
    members: [],
    connections: [],
    stores: [],
    products: [],
    listings: [],
    metrics: [],
    alerts: [],
    pillarScores: [],
    opex: {},
    revenueTargets: {},
  };

  for (const seed of WORKSPACE_SEEDS) buildWorkspace(ds, seed, now);
  return ds;
}

function buildWorkspace(ds: DemoDataset, seed: WorkspaceSeed, now: Date) {
  const wsId = stableUuid(`ws:${seed.key}`);
  ds.workspaces.push({ id: wsId, slug: seed.slug, name: seed.name, enabledModules: seed.modules });
  for (const m of seed.members) {
    ds.members.push({ workspaceId: wsId, userId: USERS[m.userKey].id, role: m.role, grantedModules: m.modules ?? [] });
  }

  const rand = mulberry32(hashString(`data:${seed.key}`));

  // Produits (prix HT, coût d'achat autour de 45 % du prix)
  const products: Product[] = seed.products.map((p) => ({
    id: stableUuid(`product:${seed.key}:${p.sku}`),
    workspaceId: wsId,
    sku: p.sku,
    brand: p.brand,
    title: p.title,
    priceHtCents: Math.round(p.price * 100),
    unitCostCents: Math.round(p.price * 100 * (0.4 + rand() * 0.1)),
  }));
  ds.products.push(...products);
  const weightBySku = new Map(seed.products.map((p) => [p.sku, p.weight]));

  // Connecteurs, boutiques, fiches
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  const syncAgo: Partial<Record<MarketplaceCode, number>> = {
    amazon_eu: 4,
    amazon_us: 12,
    amazon_jp_au: 60,
    decathlon: 8,
    kaufland: 15,
    bol: 22,
    cdiscount: 31,
    ebay: 18,
    allegro: 360,
    tiktok_shop: 2 * 24 * 60,
    alltricks: 26,
  };

  for (const plan of seed.channels) {
    const connId = stableUuid(`conn:${seed.key}:${plan.marketplace}`);
    const status = plan.status;
    ds.connections.push({
      id: connId,
      workspaceId: wsId,
      marketplace: plan.marketplace,
      status,
      method: "api",
      lastSyncAt: status === "not_connected" ? null : minutesAgo(syncAgo[plan.marketplace] ?? 30),
      tokenExpiresAt: status === "error" ? minutesAgo(2 * 24 * 60 + 120) : null,
      syncProgress: status === "syncing" ? 64 : null,
      lastError:
        status === "error"
          ? `Le jeton d'accès ${MARKETPLACES[plan.marketplace].name} a expiré. Aucune commande remontée depuis 2 jours.`
          : null,
      syncFrequencyMinutes: 15,
    });
    if (status === "not_connected") continue;

    const countries = MARKETPLACES[plan.marketplace].countries;
    const stores: Store[] = countries.map((country) => ({
      id: stableUuid(`store:${seed.key}:${plan.marketplace}:${country}`),
      workspaceId: wsId,
      connectionId: connId,
      marketplace: plan.marketplace,
      country,
      currency: CURRENCY_BY_COUNTRY[country] ?? "EUR",
    }));
    ds.stores.push(...stores);

    // Sélection des produits listés sur ce canal (les plus vendus d'abord)
    const ranked = [...products].sort((a, b) => (weightBySku.get(b.sku) ?? 0) - (weightBySku.get(a.sku) ?? 0));
    const count = Math.max(3, Math.round(ranked.length * plan.coverage));
    const listed = ranked.slice(0, count);

    const cweights = COUNTRY_WEIGHT[plan.marketplace] ?? Object.fromEntries(countries.map((c) => [c, 1 / countries.length]));
    // Petits pays : seulement les meilleures ventes
    const shares: { store: Store; product: Product; share: number }[] = [];
    for (const store of stores) {
      const cw = cweights[store.country] ?? 0.05;
      const local = cw >= 0.2 ? listed : listed.slice(0, Math.max(3, Math.round(listed.length * 0.4)));
      for (const product of local) {
        shares.push({ store, product, share: cw * (weightBySku.get(product.sku) ?? 1) });
        ds.listings.push({
          id: stableUuid(`listing:${store.id}:${product.id}`),
          workspaceId: wsId,
          productId: product.id,
          storeId: store.id,
          status: "active",
          blockReason: null,
          qualityScore: Math.round(70 + rand() * 28),
        });
      }
    }
    const totalShare = shares.reduce((s, x) => s + x.share, 0);

    generateChannelMetrics(ds, seed, plan, shares, totalShare, wsId, rand);
  }

  applyListingIncidents(ds, seed, wsId);
  buildAlerts(ds, seed, wsId, now);
  buildPillarScores(ds, seed, wsId);
  // Frais internes : 1 200 € HT par mois pour SDG (comme le suivi), 300 € pour les autres
  for (let i = 0; i < 8; i++) {
    const d = new Date(`${ds.today.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    ds.opex[`${wsId}:${d.toISOString().slice(0, 7)}`] = seed.key === "sdg" ? 120_000 : 30_000;
  }
  // Objectif de CA du mois : CA du même mois l'an dernier + 45 %, arrondi à 5 000 € HT
  const byMonth = new Map<string, number>();
  for (const m of ds.metrics) {
    if (m.workspaceId !== wsId) continue;
    byMonth.set(m.date.slice(0, 7), (byMonth.get(m.date.slice(0, 7)) ?? 0) + m.revenueHt);
  }
  for (const month of byMonth.keys()) {
    const ly = byMonth.get(`${Number(month.slice(0, 4)) - 1}${month.slice(4)}`);
    if (ly) ds.revenueTargets[`${wsId}:${month}`] = Math.round((ly * 1.45) / 500_000) * 500_000;
  }
}

function generateChannelMetrics(
  ds: DemoDataset,
  seed: WorkspaceSeed,
  plan: ChannelPlan,
  shares: { store: Store; product: Product; share: number }[],
  totalShare: number,
  wsId: string,
  rand: () => number,
) {
  const today = ds.today;
  const start = addDays(today, -(HISTORY_DAYS - 1));
  const currentMonth = monthKey(today);
  const prevEnd = previousMonthSameDay(today);
  const prevStart = `${prevEnd.slice(0, 7)}-01`;

  // 1) Série brute quotidienne du canal
  const days: string[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) days.push(d);

  const raw = new Map<string, number>();
  for (const d of days) {
    const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
    const weekFactor = weekday === 0 ? 1.12 : weekday === 6 ? 0.92 : weekday === 1 ? 1.08 : 1;
    const noise = 0.82 + rand() * 0.36;
    let level = weekFactor * noise;
    // Kaufland : décrochage sur les 7 derniers jours (cas "baisse liée au compte")
    if (seed.key === "sdg" && plan.marketplace === "kaufland" && d > addDays(today, -7)) level *= 0.55;
    if (d === today) level *= TODAY_FACTOR;
    // Événements commerciaux uniquement dans l'historique (le mois en cours est calibré sur la maquette)
    if (d < `${currentMonth}-01`) level *= eventFactor(d);
    raw.set(d, level);
  }

  // 2) Calibrage : mois en cours = mtdRevenue, même période du mois précédent = mtd / (1 + évolution)
  const sumRange = (from: string, to: string) => days.filter((d) => d >= from && d <= to).reduce((s, d) => s + raw.get(d)!, 0);
  const mtdStart = `${currentMonth}-01`;
  const mtdRaw = sumRange(mtdStart, today);
  const prevRaw = sumRange(prevStart, prevEnd);
  const mtdTarget = plan.mtdRevenue * 100;
  const prevTarget = mtdTarget / (1 + plan.evolution / 100);
  const curScale = mtdRaw > 0 ? mtdTarget / mtdRaw : 0;
  const prevScale = prevRaw > 0 ? prevTarget / prevRaw : 0;

  const dailyCents = new Map<string, number>();
  for (const d of days) {
    let scale: number;
    if (d >= mtdStart) scale = curScale;
    else if (d >= prevStart && d <= prevEnd) scale = prevScale;
    else if (d > prevEnd) {
      // fin du mois précédent : transition progressive vers le niveau actuel
      const progress = (dayOfMonth(d) - dayOfMonth(prevEnd)) / 16;
      scale = prevScale + (curScale - prevScale) * Math.min(1, Math.max(0, progress)) * 0.5;
    } else {
      // historique plus ancien : croissance d'environ 1,5 % par mois + saisonnalité (pic Black Friday / Noël)
      const monthsBack = monthDistance(d, prevStart);
      const season = SEASONALITY[Number(d.slice(5, 7)) - 1] / SEASONALITY[Number(prevStart.slice(5, 7)) - 1];
      scale = prevScale * Math.pow(0.985, monthsBack) * season;
    }
    dailyCents.set(d, raw.get(d)! * scale);
  }

  // 3) Ventilation par boutique et SKU
  const rows: DailyMetric[] = [];
  for (const d of days) {
    const channelCents = dailyCents.get(d)!;
    if (channelCents <= 0) continue;
    for (const s of shares) {
      // Ventes en unités entières : les jours sans vente n'ont pas de ligne
      const noise = 0.75 + rand() * 0.5;
      const expectedUnits = (channelCents * s.share * noise) / totalShare / s.product.priceHtCents;
      const units = Math.floor(expectedUnits) + (rand() < expectedUnits % 1 ? 1 : 0);
      if (units <= 0) continue;
      rows.push({
        workspaceId: wsId,
        date: d,
        storeId: s.store.id,
        productId: s.product.id,
        units,
        orders: Math.max(1, Math.round(units * 0.95)),
        revenueHt: Math.round(units * s.product.priceHtCents * (0.93 + rand() * 0.07)),
        commissions: 0,
        ads: 0,
        logistics: 0,
        returns: 0,
        cogs: 0,
        returnUnits: 0,
      });
    }
  }

  // Recalage exact sur les cibles (mois en cours et même période du mois précédent)
  const rescale = (from: string, to: string, target: number) => {
    const inRange = rows.filter((r) => r.date >= from && r.date <= to);
    const actual = inRange.reduce((t, r) => t + r.revenueHt, 0);
    if (actual > 0) for (const r of inRange) r.revenueHt = Math.round((r.revenueHt * target) / actual);
  };
  rescale(mtdStart, today, mtdTarget);
  rescale(prevStart, prevEnd, prevTarget);

  // Structure de coûts du canal
  const costs = CHANNEL_COSTS[plan.marketplace];
  const cogsPercent = Math.max(25, 100 - costs.commission - costs.ads - costs.logistics - costs.returns - plan.margin);
  for (const r of rows) {
    const pct = (p: number) => Math.round((r.revenueHt * p) / 100);
    // Historique (avant le mois précédent) : dérive mensuelle des pôles pour une revue mensuelle vivante
    const drift = r.date < prevStart ? monthDrift(r.date, plan.marketplace) : { ads: 1, logistics: 1, returns: 1 };
    r.commissions = pct(costs.commission);
    r.ads = pct(costs.ads * drift.ads);
    r.logistics = pct(costs.logistics * drift.logistics);
    r.returns = pct(costs.returns * drift.returns);
    r.cogs = pct(cogsPercent);
    // Retours en volume : taux propre au canal (environ 2 fois le poids du coût des retours)
    const rate = (r.returns / Math.max(1, r.revenueHt)) * 2.2;
    r.returnUnits = Math.floor(r.units * rate) + (rand() < (r.units * rate) % 1 ? 1 : 0);
  }
  ds.metrics.push(...rows);
}

function monthDistance(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.split("-").map(Number);
  const [ty, tm] = toIso.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

/** Références bloquées : 29 pour SDG (dont 12 ACTA sur Amazon DE, cf. maquette). */
function applyListingIncidents(ds: DemoDataset, seed: WorkspaceSeed, wsId: string) {
  const listings = ds.listings.filter((l) => l.workspaceId === wsId);
  const storeById = new Map(ds.stores.map((s) => [s.id, s]));
  const productById = new Map(ds.products.map((p) => [p.id, p]));
  const target = seed.key === "sdg" ? 29 : seed.key === "alpenrad" ? 3 : 0;
  if (target === 0) return;

  const blocked: Listing[] = [];
  const cutSales = (l: Listing, sinceDaysAgo: number) => {
    const since = addDays(ds.today, -sinceDaysAgo);
    for (const m of ds.metrics) {
      if (m.storeId === l.storeId && m.productId === l.productId && m.date >= since) zeroMetric(m);
    }
  };
  if (seed.key === "sdg") {
    const actaDe = listings.filter((l) => {
      const s = storeById.get(l.storeId)!;
      const p = productById.get(l.productId)!;
      return s.marketplace === "amazon_eu" && s.country === "DE" && p.brand === "ACTA";
    });
    for (const l of actaDe.slice(0, 12)) {
      l.status = "blocked";
      l.blockReason = "Informations GPSR manquantes";
      blocked.push(l);
      cutSales(l, 4);
    }
    const ns = listings.find((l) => {
      const s = storeById.get(l.storeId)!;
      return s.marketplace === "decathlon" && s.country === "FR" && productById.get(l.productId)!.sku === "NS-ECC-LITE-29";
    });
    if (ns) {
      ns.status = "blocked";
      ns.blockReason = "Catégorie refusée par Décathlon";
      blocked.push(ns);
      cutSales(ns, 8);
    }
    // Rupture : SIXTEN-GLV-WIN-S n'a plus de stock depuis 4 jours sur tous les canaux
    const glv = ds.products.find((p) => p.workspaceId === wsId && p.sku === "SIXTEN-GLV-WIN-S");
    if (glv) {
      const since = addDays(ds.today, -3);
      for (const m of ds.metrics) if (m.productId === glv.id && m.date >= since) zeroMetric(m);
    }
  }
  const reasons = ["Image principale non conforme", "EAN déjà associé à un autre produit", "Attribut obligatoire manquant", "Prix hors fourchette autorisée"];
  let i = 0;
  for (const l of listings) {
    if (blocked.length >= target) break;
    if (l.status !== "active" || i++ % 7 !== 3) continue;
    l.status = "blocked";
    l.blockReason = reasons[blocked.length % reasons.length];
    blocked.push(l);
    cutSales(l, 2);
  }
  // On retire les lignes vidées (aucune vente ce jour-là)
  ds.metrics = ds.metrics.filter((m) => m.revenueHt > 0);
}

function zeroMetric(m: DailyMetric) {
  m.units = 0;
  m.orders = 0;
  m.revenueHt = 0;
  m.commissions = 0;
  m.ads = 0;
  m.logistics = 0;
  m.returns = 0;
  m.cogs = 0;
  m.returnUnits = 0;
}

function alert(
  wsId: string,
  key: string,
  createdAt: Date,
  a: {
    severity: Severity;
    category: AlertCategory;
    pillar: number | null;
    title: string;
    detail: string;
    scope?: "sku" | "account";
    subjects: string[];
    risk: number;
    action: string | null;
    status?: Alert["status"];
  },
): Alert {
  return {
    id: stableUuid(`alert:${wsId}:${key}`),
    workspaceId: wsId,
    severity: a.severity,
    category: a.category,
    pillar: a.pillar,
    title: a.title,
    detail: a.detail,
    scope: a.scope ?? "sku",
    subjects: a.subjects,
    revenueAtRiskCents: Math.round(a.risk * 100),
    suggestedAction: a.action,
    status: a.status ?? "todo",
    createdAt: createdAt.toISOString(),
  };
}

function blockedSkus(ds: DemoDataset, wsId: string, marketplace: MarketplaceCode, country: string, brand: string): string[] {
  const storeById = new Map(ds.stores.map((st) => [st.id, st]));
  const productById = new Map(ds.products.map((p) => [p.id, p]));
  // Ordre par poids commercial : la référence la plus vendue en premier
  const weight = new Map(SDG_PRODUCTS.map((p) => [p.sku, p.weight]));
  return ds.listings
    .filter((l) => l.workspaceId === wsId && l.status === "blocked")
    .filter((l) => {
      const st = storeById.get(l.storeId)!;
      return st.marketplace === marketplace && st.country === country && productById.get(l.productId)!.brand === brand;
    })
    .map((l) => productById.get(l.productId)!.sku)
    .sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0));
}

function buildAlerts(ds: DemoDataset, seed: WorkspaceSeed, wsId: string, now: Date) {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  if (seed.key === "sdg") {
    ds.alerts.push(
      alert(wsId, "blocked-acta-de", hoursAgo(5), {
        severity: "critical",
        category: "blocked_listing",
        pillar: 4,
        title: "12 références ACTA bloquées sur Amazon DE",
        detail: "Intégration produits - Informations GPSR manquantes - 3 940 € HT de CA à risque par semaine",
        subjects: blockedSkus(ds, wsId, "amazon_eu", "DE", "ACTA"),
        risk: 3940,
        action: "Débloquer",
      }),
      alert(wsId, "stockout-sixten-glv", hoursAgo(3), {
        severity: "critical",
        category: "stockout",
        pillar: 2,
        title: "Rupture sur 4 canaux",
        detail: "Catalogue produits - Couverture 0 jour - 46 ventes perdues estimées",
        subjects: ["SIXTEN-GLV-WIN-S"],
        risk: 1380,
        action: "Lancer le réassort",
      }),
      alert(wsId, "drop-kaufland-de", hoursAgo(9), {
        severity: "important",
        category: "sales_drop",
        pillar: 6,
        title: "Kaufland DE : ventes -38 % vs S-1",
        detail: "Remontée des commandes - Baisse liée au compte - Buy Box perdue sur 21 SKU",
        scope: "account",
        subjects: ["Compte Kaufland DE"],
        risk: 2100,
        action: "Voir les SKU",
      }),
      alert(wsId, "tacos-amazon-fr", hoursAgo(20), {
        severity: "important",
        category: "tacos",
        pillar: 5,
        title: "TACoS Amazon FR à 12,8 % (cible 10 %)",
        detail: "Publicité et deals - 3 campagnes SIXTEN au-dessus du seuil",
        subjects: ["Campagnes SP SIXTEN"],
        risk: 640,
        action: "Ajuster",
      }),
      alert(wsId, "sync-allegro", hoursAgo(6), {
        severity: "info",
        category: "sync",
        pillar: null,
        title: "Synchro Allegro en retard",
        detail: "Connecteurs - Dernière mise à jour il y a 6 h",
        subjects: ["Allegro PL"],
        risk: 0,
        action: "Relancer",
      }),
      alert(wsId, "token-tiktok", hoursAgo(50), {
        severity: "important",
        category: "sync",
        pillar: 6,
        title: "Jeton TikTok Shop expiré",
        detail: "Connecteurs - Aucune commande remontée depuis 2 jours - 37 commandes en attente estimées",
        subjects: ["TikTok Shop"],
        risk: 860,
        action: "Reconnecter",
      }),
      alert(wsId, "blocked-ns-decathlon", hoursAgo(30), {
        severity: "critical",
        category: "blocked_listing",
        pillar: 4,
        title: "Vélo NS Bikes Eccentric Lite 29 bloqué sur Décathlon",
        detail: "Intégration produits - Catégorie refusée - ventes -48 % sur le mois",
        subjects: ["NS-ECC-LITE-29"],
        risk: 1040,
        action: "Débloquer",
      }),
    );
  } else if (seed.key === "alpenrad") {
    ds.alerts.push(
      alert(wsId, "token-bol", hoursAgo(26), {
        severity: "critical",
        category: "sync",
        pillar: 6,
        title: "Connecteur Bol.com en erreur",
        detail: "Connecteurs - Jeton expiré, commandes non remontées",
        subjects: ["Bol.com NL", "Bol.com BE"],
        risk: 420,
        action: "Reconnecter",
      }),
      alert(wsId, "blocked-alp", hoursAgo(12), {
        severity: "critical",
        category: "blocked_listing",
        pillar: 4,
        title: "3 références bloquées sur Amazon",
        detail: "Intégration produits - Attribut obligatoire manquant",
        subjects: ["ALP-STEM-50", "ALP-BAR-780", "ALP-CHAIN-12S"],
        risk: 690,
        action: "Débloquer",
      }),
    );
  } else {
    ds.alerts.push(
      alert(wsId, "drop-decathlon", hoursAgo(15), {
        severity: "important",
        category: "sales_drop",
        pillar: 2,
        title: "Décathlon FR : ventes -8 % vs mois précédent",
        detail: "Baisse concentrée sur 2 SKU - Prix non compétitif",
        subjects: ["KRK-BAG-6-0", "KRK-PONCHO-BLK"],
        risk: 310,
        action: "Voir les SKU",
      }),
    );
  }
}

const PILLAR_SCORES: Record<string, [number, string][]> = {
  sdg: [
    [82, "5 produits en phase J+90"],
    [74, "38 fiches sous 80 % de qualité"],
    [91, "98,2 % expédiés à temps"],
    [58, "29 références bloquées"],
    [71, "TACoS 8,9 % - Black Friday J-12"],
    [95, "3 anomalies sur 2 846"],
    [79, "Réponse moyenne en 9 h"],
  ],
  kraken: [
    [68, "2 produits en phase J+90"],
    [81, "4 fiches sous 80 % de qualité"],
    [88, "96,5 % expédiés à temps"],
    [92, "Aucune référence bloquée"],
    [64, "TACoS 11,2 %"],
    [90, "1 anomalie"],
    [83, "Réponse moyenne en 6 h"],
  ],
  alpenrad: [
    [75, "3 produits en phase J+90"],
    [77, "9 fiches sous 80 % de qualité"],
    [84, "95,1 % expédiés à temps"],
    [61, "3 références bloquées"],
    [79, "TACoS 7,4 %"],
    [56, "Connecteur Bol.com en erreur"],
    [72, "Réponse moyenne en 14 h"],
  ],
};

function buildPillarScores(ds: DemoDataset, seed: WorkspaceSeed, wsId: string) {
  const scores = PILLAR_SCORES[seed.key];
  scores.forEach(([score, headline], i) => {
    ds.pillarScores.push({ workspaceId: wsId, date: ds.today, pillar: i + 1, score, headline });
  });
}
