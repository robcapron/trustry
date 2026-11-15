/**
 * Faux client Supabase en mémoire (sous-ensemble utilisé par les jobs de synchro),
 * pour tester la chaîne synchro -> métriques -> alertes sans base distante.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export function createFakeSupabase(seed: Record<string, Row[]> = {}, rpc: Record<string, (args: Row) => unknown> = {}) {
  const tables = new Map<string, Row[]>(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  const table = (name: string) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  };

  function builder(name: string) {
    const filters: Filter[] = [];
    let op: { kind: "select" | "insert" | "upsert" | "update" | "delete"; rows?: Row[]; values?: Row; onConflict?: string } = { kind: "select" };
    let returning = false;
    let single: "one" | "maybe" | null = null;
    let order: { col: string; asc: boolean } | null = null;
    let range: [number, number] | null = null;

    const run = () => {
      const rows = table(name);
      let out: Row[] = [];
      if (op.kind === "insert") {
        out = op.rows!.map((r) => ({ id: randomUUID(), ...r }));
        rows.push(...out);
      } else if (op.kind === "upsert") {
        const keys = (op.onConflict ?? "id").split(",");
        for (const r of op.rows!) {
          const existing = rows.find((x) => keys.every((k) => x[k] === r[k]));
          if (existing) Object.assign(existing, r);
          else rows.push({ id: randomUUID(), ...r });
        }
      } else if (op.kind === "update") {
        out = rows.filter((r) => filters.every((f) => f(r)));
        out.forEach((r) => Object.assign(r, op.values));
      } else if (op.kind === "delete") {
        const keep = rows.filter((r) => !filters.every((f) => f(r)));
        tables.set(name, keep);
      } else {
        out = rows.filter((r) => filters.every((f) => f(r)));
        if (order) out = [...out].sort((a, b) => (String(a[order!.col]) < String(b[order!.col]) ? -1 : 1) * (order!.asc ? 1 : -1));
        if (range) out = out.slice(range[0], range[1] + 1);
      }
      if (op.kind !== "select" && !returning) return { data: null, error: null };
      const data = out.map((r) => ({ ...r }));
      if (single === "one") return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: "not single" } };
      if (single === "maybe") return { data: data[0] ?? null, error: null };
      return { data, error: null };
    };

    const b = {
      select() {
        if (op.kind !== "select") returning = true;
        return b;
      },
      insert(rows: Row | Row[]) {
        op = { kind: "insert", rows: Array.isArray(rows) ? rows : [rows] };
        return b;
      },
      upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
        op = { kind: "upsert", rows: Array.isArray(rows) ? rows : [rows], onConflict: opts?.onConflict };
        return b;
      },
      update(values: Row) {
        op = { kind: "update", values };
        return b;
      },
      delete() {
        op = { kind: "delete" };
        return b;
      },
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), b),
      lte: (c: string, v: string) => (filters.push((r) => String(r[c]) <= v), b),
      lt: (c: string, v: string) => (filters.push((r) => String(r[c]) < v), b),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending ?? true }), b),
      range: (a: number, z: number) => ((range = [a, z]), b),
      single: () => ((single = "one"), b),
      maybeSingle: () => ((single = "maybe"), b),
      then<T>(resolve: (v: ReturnType<typeof run>) => T, reject?: (e: unknown) => T) {
        try {
          return Promise.resolve(resolve(run()));
        } catch (e) {
          return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
        }
      },
    };
    return b;
  }

  const client = {
    from: (name: string) => builder(name),
    rpc: async (name: string, args: Row) => ({ data: rpc[name]?.(args) ?? null, error: null }),
  };
  return { client: client as unknown as SupabaseClient, tables };
}
