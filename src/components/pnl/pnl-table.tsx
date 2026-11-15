"use client";

import { useState } from "react";
import { Icon } from "@/components/trustry/icons";
import { pnlMetrics, type PnlNode } from "@/domain/pnl";
import { formatDeltaPercent, formatEur, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const COST_COLS: { key: "commissions" | "ads" | "logistics" | "returns" | "cogs"; label: string }[] = [
  { key: "commissions", label: "Commissions" },
  { key: "ads", label: "Publicité" },
  { key: "logistics", label: "Logistique" },
  { key: "returns", label: "Retours" },
  { key: "cogs", label: "Coût d'achat" },
];

function DeltaCell({ value }: { value: number | null }) {
  return (
    <td className={cn("px-2 text-right font-semibold whitespace-nowrap tabular", value === null ? "text-muted" : value >= 0 ? "text-bon" : "text-critique")}>
      {value === null ? "-" : formatDeltaPercent(value)}
    </td>
  );
}

function Row({
  node,
  depth,
  open,
  onToggle,
  canExpand,
  desktopOnlyToggle = false,
}: {
  node: PnlNode;
  depth: number;
  open: boolean;
  onToggle?: () => void;
  canExpand: boolean;
  /** sur iPhone, lecture simplifiée canal > pays : le pays n'est pas dépliable */
  desktopOnlyToggle?: boolean;
}) {
  const m = pnlMetrics(node);
  const isTotal = node.key === "total";
  return (
    <tr
      className={cn(
        "border-t border-line",
        node.level === "channel" && !isTotal && "bg-blanc/0 font-semibold",
        node.level === "sku" && "text-ink-2 max-lg:hidden",
        isTotal && "border-t-2 border-carbone font-bold",
      )}
    >
      <th scope="row" className="py-2.5 pr-2 text-left font-[inherit]" style={{ paddingLeft: depth * 20 }}>
        <span className="flex items-center gap-1.5">
          {canExpand ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={`${open ? "Replier" : "Déplier"} ${node.label}`}
              className={cn(
                "grid size-5 flex-none cursor-pointer place-items-center rounded-md text-muted hover:bg-blanc",
                desktopOnlyToggle && "max-lg:hidden",
              )}
            >
              <Icon name={open ? "chevronDown" : "chevronRight"} size={14} strokeWidth={2} />
            </button>
          ) : null}
          {canExpand && desktopOnlyToggle ? <span className="w-5 flex-none lg:hidden" /> : null}
          {canExpand ? null : (
            <span className="w-5 flex-none" />
          )}
          <span className="min-w-0">
            <span className={cn("block", node.level === "sku" && "font-medium text-ink")}>{node.label}</span>
            {node.sublabel ? <span className="block font-mono text-2xs font-normal text-muted">{node.sublabel}</span> : null}
          </span>
        </span>
      </th>
      <td className="px-2 text-right whitespace-nowrap tabular">{formatEur(m.revenue)}</td>
      <DeltaCell value={m.delta} />
      {COST_COLS.map((c) => (
        <td key={c.key} className="hidden px-2 text-right whitespace-nowrap text-ink-2 tabular lg:table-cell">
          {formatEur(m[c.key])}
        </td>
      ))}
      <td className="hidden px-2 text-right whitespace-nowrap tabular lg:table-cell">{formatEur(m.profit)}</td>
      <td className="px-2 text-right font-semibold whitespace-nowrap tabular">{m.margin === null ? "-" : formatPercent(m.margin)}</td>
      <td className="hidden pl-2 text-right whitespace-nowrap text-ink-2 tabular lg:table-cell">{m.tacos === null ? "-" : formatPercent(m.tacos)}</td>
    </tr>
  );
}

/** Tableau P&L dépliable canal > pays > SKU (SKU visibles sur ordinateur). */
export function PnlTable({ rows, total, expandAll }: { rows: PnlNode[]; total: PnlNode; expandAll: boolean }) {
  const [open, setOpen] = useState<Set<string>>(() => (expandAll ? new Set(rows.flatMap((r) => [r.key, ...r.children.map((c) => c.key)])) : new Set()));
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-ui">
        <thead>
          <tr className="text-caption text-muted">
            <th className="pb-2 text-left font-medium">Canal / pays / SKU</th>
            <th className="px-2 pb-2 text-right font-medium whitespace-nowrap">CA HT</th>
            <th className="px-2 pb-2 text-right font-medium">Évol.</th>
            {COST_COLS.map((c) => (
              <th key={c.key} className="hidden px-2 pb-2 text-right font-medium whitespace-nowrap lg:table-cell">
                {c.label}
              </th>
            ))}
            <th className="hidden px-2 pb-2 text-right font-medium whitespace-nowrap lg:table-cell">Profit net</th>
            <th className="px-2 pb-2 text-right font-medium">Marge</th>
            <th className="hidden pb-2 pl-2 text-right font-medium lg:table-cell">TACoS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ch) => (
            <ChannelRows key={ch.key} node={ch} open={open} toggle={toggle} />
          ))}
          <Row node={total} depth={0} open={false} canExpand={false} />
        </tbody>
      </table>
    </div>
  );
}

function ChannelRows({ node, open, toggle }: { node: PnlNode; open: Set<string>; toggle: (k: string) => void }) {
  const isOpen = open.has(node.key);
  return (
    <>
      <Row node={node} depth={0} open={isOpen} onToggle={() => toggle(node.key)} canExpand />
      {isOpen
        ? node.children.map((co) => {
            const coOpen = open.has(co.key);
            return (
              <CountryRows key={co.key} node={co} open={coOpen} toggle={() => toggle(co.key)} />
            );
          })
        : null}
    </>
  );
}

function CountryRows({ node, open, toggle }: { node: PnlNode; open: boolean; toggle: () => void }) {
  return (
    <>
      <Row node={node} depth={1} open={open} onToggle={toggle} canExpand desktopOnlyToggle />
      {open ? node.children.map((sku) => <Row key={sku.key} node={sku} depth={2} open={false} canExpand={false} />) : null}
    </>
  );
}
