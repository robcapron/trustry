import { describe, expect, it } from "vitest";
import {
  formatDeltaPercent,
  formatDeltaPoints,
  formatEur,
  formatEurCompact,
  formatNumber,
  formatPercent,
  formatRelative,
  initials,
  sanitizeDashes,
} from "@/lib/format";
import { EM_DASH, EN_DASH, FORBIDDEN_DASHES, MINUS_SIGN, NBSP } from "./chars";


describe("formatage FR", () => {
  it("formate les montants en euros (centimes en entrée)", () => {
    expect(formatEur(14238000)).toBe(`142${NBSP}380${NBSP}€`);
    expect(formatEur(123456, 2)).toBe(`1${NBSP}234,56${NBSP}€`);
    expect(formatEur(5003, 2)).toBe(`50,03${NBSP}€`);
  });

  it("formate les pourcentages et évolutions", () => {
    expect(formatPercent(21.4)).toBe(`21,4${NBSP}%`);
    expect(formatDeltaPercent(12.4)).toBe(`+12,4${NBSP}%`);
    expect(formatDeltaPercent(-21.3)).toBe(`-21,3${NBSP}%`);
    expect(formatDeltaPercent(-0.04)).toBe(`0,0${NBSP}%`);
    expect(formatDeltaPoints(-0.6)).toBe(`-0,6${NBSP}pt`);
  });

  it("n'utilise jamais de tiret long, demi-cadratin ou signe moins typographique", () => {
    const outputs = [formatNumber(-1234.5, 1), formatEur(-99900), formatDeltaPercent(-3), formatPercent(-2)];
    for (const o of outputs) expect(o).not.toMatch(FORBIDDEN_DASHES);
    expect(sanitizeDashes(`A ${EM_DASH} B ${EN_DASH} C ${MINUS_SIGN} D`)).toBe("A - B - C - D");
  });

  it("formate les axes compacts", () => {
    expect(formatEurCompact(12000)).toBe(`12${NBSP}k€`);
    expect(formatEurCompact(0)).toBe("0");
  });

  it("formate les durées relatives comme les maquettes", () => {
    const now = new Date("2026-11-15T15:00:00Z");
    expect(formatRelative(new Date("2026-11-15T14:56:00Z"), now)).toBe(`il y a 4${NBSP}min`);
    expect(formatRelative(new Date("2026-11-15T14:00:00Z"), now)).toBe(`il y a 1${NBSP}h`);
    expect(formatRelative(new Date("2026-11-13T15:00:00Z"), now)).toBe(`il y a 2${NBSP}j`);
  });

  it("calcule les initiales d'espace", () => {
    expect(initials("SDG Distribution")).toBe("SD");
    expect(initials("Kraken Surf Co")).toBe("KS");
    expect(initials("Alpenrad")).toBe("AL");
  });
});
