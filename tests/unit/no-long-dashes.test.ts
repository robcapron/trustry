import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FORBIDDEN_DASHES } from "./chars";

/** Règle non négociable : aucun tiret long ni demi-cadratin dans le code et les textes de l'app. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(tsx?|css|sql|md)$/.test(name) ? [p] : [];
  });
}

describe("tirets", () => {
  it("n'apparaissent dans aucun fichier source", () => {
    const root = path.resolve(__dirname, "../..");
    const files = [...walk(path.join(root, "src")), ...walk(path.join(root, "supabase")), path.join(root, "CLAUDE.md")];
    const offenders = files.filter((f) => FORBIDDEN_DASHES.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
