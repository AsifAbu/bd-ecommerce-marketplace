import { Check, Info, Minus, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge, EmptyState, FilterChips, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";
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

// Status is always an icon shape plus words; the colour only supports it.
const STATUS_VIEW = {
  met: { icon: Check, tone: "text-jade" },
  not_met: { icon: X, tone: "text-vermilion" },
  no_data: { icon: Minus, tone: "text-muted" },
  tracked: { icon: Info, tone: "text-muted" },
} as const satisfies Record<Tile["status"], { icon: LucideIcon; tone: string }>;

function KpiRow({ tile }: { tile: Tile }) {
  const { icon: Icon, tone } = STATUS_VIEW[tile.status];
  return (
    <Tr data-testid={`tile-${tile.key}`} data-status={tile.status}>
      <Th scope="row" className="text-base sm:w-1/4">
        {tile.label}
      </Th>
      <Td label="Value" align="right" className="text-lg font-semibold sm:whitespace-nowrap">
        {show(tile, tile.value)}
      </Td>
      <Td label="Status">
        <span className={`inline-flex items-center gap-1.5 font-medium ${tone}`}>
          <Icon aria-hidden="true" size={16} />
          {STATUS_LABELS[tile.status]}
        </span>
        {tile.target !== null && <span className="block text-muted">target {show(tile, tile.target)}</span>}
      </Td>
      <Td label="What it measures" className="text-muted sm:w-2/5">
        {tile.detail}
      </Td>
    </Tr>
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`GMV per day, ${data.length} days, highest ${tk(best?.amount ?? 0)} on ${best?.day ?? "n/a"}. The table below has every day.`}
          className="h-36 w-full rounded-lg bg-surface text-edge"
        >
          <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke="currentColor" />
          {data.map((d, i) => {
            const h = (d.amount / max) * (H - 8);
            return (
              <rect key={d.day} x={i * (bar + gap)} y={H - h} width={bar} height={h} className="fill-jade">
                <title>{`${d.day}: ${tk(d.amount)}`}</title>
              </rect>
            );
          })}
        </svg>
        <p className="tabular flex justify-between text-xs text-muted" aria-hidden="true">
          <span>{data[0]?.day}</span>
          <span>highest day {tk(best?.amount ?? 0)}</span>
          <span>{data[data.length - 1]?.day}</span>
        </p>
      </div>
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-jade underline underline-offset-4 sm:min-h-9">Show GMV by day as a table</summary>
        <div className="mt-2 max-w-xl" data-testid="gmv-table">
          <Table caption="GMV by day (Asia/Dhaka)">
            <Thead>
              <tr>
                <Th>Day</Th>
                <Th align="right">Delivered orders</Th>
                <Th align="right">GMV</Th>
              </tr>
            </Thead>
            <Tbody>
              {data.map((d) => (
                <Tr key={d.day}>
                  <Th scope="row" className="py-1.5 font-normal">
                    {d.day}
                  </Th>
                  <Td align="right" className="py-1.5">
                    {d.orders}
                  </Td>
                  <Td align="right" className="py-1.5">
                    {tk(d.amount)}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </details>
    </div>
  );
}

/** US-083: the admin marketplace metrics page body. */
export function MetricsDashboardView({ data }: { data: MetricsDashboard }) {
  const attentionTotal = data.attention.reduce((n, a) => n + a.count, 0);
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <FilterChips label="Time window" items={WINDOW_CHOICES.map((d) => ({ label: `${d} days`, href: `/admin/metrics?days=${d}`, current: d === data.days }))} />
        <p className="text-sm text-muted">Days are Asia/Dhaka calendar days. Updated {new Date(data.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}.</p>
      </div>

      <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
        <h2 id="attention-heading" className="text-xl font-semibold">
          Needs attention
        </h2>
        {attentionTotal === 0 && <p className="text-muted">Nothing needs attention right now.</p>}
        <ul className="overflow-hidden rounded-lg border border-line" data-testid="attention">
          {data.attention.map((a) => (
            <li key={a.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-3 first:border-t-0">
              <div className="min-w-0">
                <Link className="font-medium text-jade underline-offset-4 hover:underline" href={a.href}>
                  {a.label}
                </Link>
                {a.examples.length > 0 && <p className="text-sm text-muted">For example {a.examples.join(", ")}</p>}
              </div>
              <p className="flex items-center gap-2">
                <strong className="tabular text-lg">{a.count}</strong>
                <Badge tone={a.count > 0 ? "sale" : "brand"}>{a.count > 0 ? "To look at" : "All clear"}</Badge>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="kpi-heading" className="flex flex-col gap-3">
        <h2 id="kpi-heading" className="text-xl font-semibold">
          Key figures, last {data.days} days
        </h2>
        <Table caption={`Key figures, last ${data.days} days`} stack>
          <Thead>
            <tr>
              <Th>Measure</Th>
              <Th align="right">Value</Th>
              <Th>Status</Th>
              <Th>What it measures</Th>
            </tr>
          </Thead>
          <Tbody>
            {data.tiles.map((t) => (
              <KpiRow key={t.key} tile={t} />
            ))}
          </Tbody>
        </Table>
      </section>

      <section aria-labelledby="gmv-heading" className="flex flex-col gap-3">
        <h2 id="gmv-heading" className="text-xl font-semibold">
          GMV by day
        </h2>
        <p className="text-sm text-muted">
          Total {tk(data.gmv.total)} from {data.gmv.orders} delivered shop orders.
        </p>
        <GmvChart data={data.gmv.byDay} />
      </section>

      <section aria-labelledby="top-heading" className="flex flex-col gap-3">
        <h2 id="top-heading" className="text-xl font-semibold">
          Top shops by GMV
        </h2>
        {data.topShops.length === 0 ? (
          <EmptyState title="No delivered orders in this window" description="Choose a longer window to see more shops." />
        ) : (
          <div data-testid="top-shops">
            <Table caption="Top shops by GMV" stack>
              <Thead>
                <tr>
                  <Th>Shop</Th>
                  <Th align="right">GMV</Th>
                  <Th align="right">Delivered orders</Th>
                </tr>
              </Thead>
              <Tbody>
                {data.topShops.map((s) => (
                  <Tr key={s.shopId}>
                    <Th scope="row">{s.name}</Th>
                    <Td label="GMV" align="right">
                      {tk(s.gmv)}
                    </Td>
                    <Td label="Delivered orders" align="right">
                      {s.orders}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
