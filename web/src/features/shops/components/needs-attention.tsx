import Link from "next/link";
import { Badge, Section, TextLink } from "@/components/ui";
import type { TicketView } from "@/features/complaints/views";
import { formatDhakaTime } from "@/features/orders";
import { HandoverDeadline, OverdueBadge } from "@/features/orders/lifecycle/ui/badges";
import type { ShopOrderListView } from "@/features/orders/lifecycle/views";
import type { LowStockItem } from "@/features/products/low-stock";
import type { ReturnView } from "@/features/returns/views";
import { DueBadge } from "@/features/complaints/ui/ticket-views";

const MAX_ROWS = 4;

const row = "flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4";
const rowLink = "font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink";

function Group({ title, count, seeAll, children }: { title: string; count: number; seeAll: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-base font-semibold">
          {title} ({count})
        </h3>
        {count > MAX_ROWS && (
          <TextLink href={seeAll.href} className="text-sm">
            {seeAll.label}
          </TextLink>
        )}
      </div>
      <ul className="divide-y divide-line border-y border-line">{children}</ul>
    </div>
  );
}

/**
 * The "what needs action" block of the seller dashboard: orders waiting for handover with the
 * 48 h countdown, returns and complaints that wait for an answer, and low stock. Presentational:
 * the page loads the lists (all guard-checked and scoped to the shop).
 */
export function NeedsAttention({
  shopId,
  orders,
  returns,
  complaints,
  lowStock,
}: {
  shopId: string;
  orders: ShopOrderListView[];
  returns: ReturnView[];
  complaints: TicketView[];
  lowStock: LowStockItem[];
}) {
  const base = `/seller/${shopId}`;
  const empty = orders.length + returns.length + complaints.length + lowStock.length === 0;
  return (
    <Section title="Needs your attention">
      {empty && <p className="text-muted">Nothing needs action right now. New orders, returns and complaints show up here.</p>}
      {orders.length > 0 && (
        <Group title="Orders to hand over" count={orders.length} seeAll={{ href: `${base}/orders`, label: "See all orders" }}>
          {orders.slice(0, MAX_ROWS).map((o) => (
            <li key={o.id} className={row}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link className={rowLink} href={`${base}/orders/${o.id}`}>
                  {o.shopOrderNo}
                  <span className="sr-only">, {o.statusLabel}</span>
                </Link>
                <p className="truncate text-sm text-muted">
                  {o.customerName}, {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {o.overdue && <OverdueBadge />}
                <HandoverDeadline so={o} />
              </div>
            </li>
          ))}
        </Group>
      )}
      {returns.length > 0 && (
        <Group title="Returns waiting for your answer" count={returns.length} seeAll={{ href: `${base}/returns`, label: "See all returns" }}>
          {returns.slice(0, MAX_ROWS).map((r) => (
            <li key={r.id} className={row}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link className={rowLink} href={`${base}/returns`}>
                  {r.quantity} × {r.item.title}
                </Link>
                <p className="text-sm text-muted">{r.shopOrderNo}, {r.reasonLabel}</p>
              </div>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                Answer by {formatDhakaTime(r.shopDueAt)}
                {r.shopOverdue && <Badge tone="sale">Overdue</Badge>}
              </p>
            </li>
          ))}
        </Group>
      )}
      {complaints.length > 0 && (
        <Group title="Complaints to answer" count={complaints.length} seeAll={{ href: `${base}/complaints`, label: "See all complaints" }}>
          {complaints.slice(0, MAX_ROWS).map((t) => (
            <li key={t.id} className={row}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link className={rowLink} href={`${base}/complaints/${t.id}`}>
                  {t.ticketNo}: {t.subject}
                </Link>
                <p className="text-sm text-muted">{t.categoryLabel}</p>
              </div>
              <DueBadge ticket={t} />
            </li>
          ))}
        </Group>
      )}
      {lowStock.length > 0 && (
        <Group title="Low stock" count={lowStock.length} seeAll={{ href: `${base}/products`, label: "See all products" }}>
          {lowStock.slice(0, MAX_ROWS).map((p) => (
            <li key={p.productId} className={row}>
              <Link className={`${rowLink} min-w-0`} href={`${base}/products/${p.productId}`}>
                {p.title}
              </Link>
              <Badge tone={p.stock === 0 ? "sale" : "warning"}>{p.stock === 0 ? "Out of stock" : `${p.stock} left`}</Badge>
            </li>
          ))}
        </Group>
      )}
    </Section>
  );
}
