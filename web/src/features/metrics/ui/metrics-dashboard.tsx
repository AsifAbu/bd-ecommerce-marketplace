import Link from "next/link";
import { STATUS_LABELS } from "../calculators";
import { WINDOW_CHOICES } from "../config";
import type { MetricsDashboard, Tile } from "../service";

const tk = (n: number) => `Tk ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${(n * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;

function show(t: Tile, n: number | null): string {
  if (n === null) return "No data";
  if (t.format === "percent") return pct(n);
  if (t.format === "money") return tk(n);
  if (t.format === "rating") return `${n.toFixed(1)} / 5`;
  return n.toLocaleString("en-US");
}

const STATUS_STYLE = {
  met: "border-green-700 bg-green-50 text-green-900",
  not_met: "border-red-700 bg-red-50 text-red-900",
  no_data: "border-gray-400 bg-gray-50 text-gray-900",
  tracked: "border-blue-700 bg-blue-50 text-blue-900",
} as const;
const STATUS_ICON = { met: "✓", not_met: "✗", no_data: "–", tracked: "i" } as const;

function KpiTile({ tile }: { tile: Tile }) {
  return (
    <li data-testid={`tile-${tile.key}`} data-status={tile.status} className="flex flex-col gap-1 rounded border border-gray-300 p-4">
      <h3 className="text-sm font-medium text-gray-800">{tile.label}</h3>
      <p className="text-2xl font-bold">{show(tile, tile.value)}</p>
      <p className={`inline-flex w-fit items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[tile.status]}`}>
        <span aria-hidden="true">{STATUS_ICON[tile.status]}</span>
        {STATUS_LABELS[tile.status]}
        {tile.target !== null && ` (target ${show(tile, tile.target)})`}
      </p>
      <p className="text-xs text-gray-700">{tile.detail}</p>
    </li>
  );
}

/** Bars scaled to the best day; an SVG with a text alternative and a table with the same numbers below. */
function GmvChart({ data }: { data: MetricsDashboard["gmv"]["byDay"] }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const W = 600;
  const H = 120;
  const gap = data.length > 60 ? 0.5 : 2;
  const bar = (W - gap * (data.length - 1)) / data.length;
  const best = data.reduce((a, d) => (d.amount > a.amount ? d : a), data[0]);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`GMV per day, ${data.length} days, highest ${tk(best?.amount ?? 0)} on ${best?.day ?? "n/a"}. The table below has every day.`} className="h-32 w-full">
        <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke="currentColor" strokeOpacity="0.4" />
        {data.map((d, i) => {
          const h = (d.amount / max) * (H - 4);
          return <rect key={d.day} x={i * (bar + gap)} y={H - h} width={bar} height={h} className="fill-blue-700"><title>{`${d.day}: ${tk(d.amount)}`}</title></rect>;
        })}
      </svg>
      <details className="text-sm">
        <summary className="cursor-pointer text-blue-800 underline">Show GMV by day as a table</summary>
        <table className="mt-2 w-full max-w-md border-collapse text-left" data-testid="gmv-table">
          <caption className="sr-only">GMV by day (Asia/Dhaka)</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-gray-400 py-1 pr-4">Day</th>
              <th scope="col" className="border-b border-gray-400 py-1 pr-4 text-right">Delivered orders</th>
              <th scope="col" className="border-b border-gray-400 py-1 text-right">GMV</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}>
                <th scope="row" className="py-0.5 pr-4 font-normal">{d.day}</th>
                <td className="py-0.5 pr-4 text-right">{d.orders}</td>
                <td className="py-0.5 text-right">{tk(d.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

/** US-083: the admin marketplace metrics page body. */
export function MetricsDashboardView({ data }: { data: MetricsDashboard }) {
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Time window" className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Window:</span>
        {WINDOW_CHOICES.map((d) => (
          <Link
            key={d}
            href={`/admin/metrics?days=${d}`}
            aria-current={d === data.days ? "page" : undefined}
            className={d === data.days ? "rounded border border-blue-800 bg-blue-800 px-3 py-1 font-semibold text-white" : "rounded border border-gray-500 px-3 py-1 text-blue-800 underline"}
          >
            {d} days
          </Link>
        ))}
        <span className="text-sm text-gray-700">Days are Asia/Dhaka calendar days. Updated {new Date(data.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}.</span>
      </nav>

      <section aria-labelledby="attention-heading" className="flex flex-col gap-2 rounded border border-gray-300 p-4">
        <h2 id="attention-heading" className="text-xl font-semibold">Needs attention</h2>
        <ul className="flex flex-col gap-1" data-testid="attention">
          {data.attention.map((a) => (
            <li key={a.label}>
              <Link className="text-blue-800 underline" href={a.href}>{a.label}</Link>:{" "}
              <strong className={a.count > 0 ? "text-red-800" : "text-green-800"}>{a.count}</strong>
              {a.examples.length > 0 && <span className="text-sm text-gray-700"> (e.g. {a.examples.join(", ")})</span>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="kpi-heading" className="flex flex-col gap-3">
        <h2 id="kpi-heading" className="text-xl font-semibold">Key figures, last {data.days} days</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.tiles.map((t) => (
            <KpiTile key={t.key} tile={t} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="gmv-heading" className="flex flex-col gap-2">
        <h2 id="gmv-heading" className="text-xl font-semibold">GMV by day</h2>
        <p className="text-sm text-gray-700">Total {tk(data.gmv.total)} from {data.gmv.orders} delivered shop orders.</p>
        <GmvChart data={data.gmv.byDay} />
      </section>

      <section aria-labelledby="top-heading" className="flex flex-col gap-2">
        <h2 id="top-heading" className="text-xl font-semibold">Top shops by GMV</h2>
        {data.topShops.length === 0 ? (
          <p>No delivered orders in this window.</p>
        ) : (
          <ol className="list-decimal pl-6" data-testid="top-shops">
            {data.topShops.map((s) => (
              <li key={s.shopId}>
                {s.name}: {tk(s.gmv)} ({s.orders} delivered)
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
