/** Mini-courbe des cartes KPI (tracé des maquettes : 100 x 28, trait 2 px non mis à l'échelle). */
export function Sparkline({ values, color = "#111214" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 26 - ((v - min) / span) * 24;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" height="32" preserveAspectRatio="none" aria-hidden="true" className="w-[56px] min-w-0 shrink 2xl:w-[90px]">
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
