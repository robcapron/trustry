import "server-only";
import { buildDemoDataset, parisToday, type DemoDataset } from "./seed";

// Jeu de données de démo, régénéré une fois par jour (déterministe).
let cached: { day: string; data: DemoDataset } | null = null;

export function getDemoDataset(): DemoDataset {
  const day = parisToday();
  if (!cached || cached.day !== day) cached = { day, data: buildDemoDataset() };
  return cached.data;
}
