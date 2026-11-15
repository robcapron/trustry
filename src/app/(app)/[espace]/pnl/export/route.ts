import { NextResponse, type NextRequest } from "next/server";
import { parsePeriod, buildPeriod } from "@/domain/period";
import { flattenPnl, pnlMetrics } from "@/domain/pnl";
import { formatNumber, sanitizeDashes } from "@/lib/format";
import { parsePnlFilters } from "@/lib/search-params";
import { getCurrentUser, getPnl, getToday, getWorkspace } from "@/server/data";

/** Export CSV du P&L (séparateur ;, décimales à la virgule, montants en € HT, marges en %). */
export async function GET(request: NextRequest, { params }: RouteContext<"/[espace]/pnl/export">) {
  const { espace } = await params;
  if (!(await getCurrentUser())) return new NextResponse("Non connecté", { status: 401 });
  const workspace = await getWorkspace(espace);
  if (!workspace) return new NextResponse("Introuvable", { status: 404 });

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const periodKey = parsePeriod(query.periode);
  const view = await getPnl(workspace.id, periodKey, parsePnlFilters(query));
  const period = buildPeriod(periodKey, await getToday());

  const eur = (cents: number) => formatNumber(cents / 100, 2).replace(/\s/g, "");
  const pct = (v: number | null) => (v === null ? "" : formatNumber(v, 1));
  const cell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

  const header = [
    "Canal", "Pays", "SKU", "Produit", "CA HT (€)", "Évolution CA (%)", "Commissions (€)", "Publicité (€)",
    "Logistique (€)", "Retours (€)", "Coût d'achat (€)", "Profit net (€)", "Marge nette (%)", "TACoS (%)", "Unités",
  ];
  const lines = flattenPnl(view).map(({ channel, country, node }) => {
    const m = pnlMetrics(node);
    return [
      channel, country, node.sublabel ?? "", node.label, eur(m.revenue), pct(m.delta), eur(m.commissions), eur(m.ads),
      eur(m.logistics), eur(m.returns), eur(m.cogs), eur(m.profit), pct(m.margin), pct(m.tacos), String(node.totals.units),
    ];
  });
  const csv = String.fromCharCode(0xfeff) + [header, ...lines].map((r) => r.map((v) => cell(sanitizeDashes(v))).join(";")).join("\r\n");
  const filename = `pnl-${workspace.slug}-${period.current.from}-${period.current.to}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
