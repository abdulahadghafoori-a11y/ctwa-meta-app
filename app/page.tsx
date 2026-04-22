import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  contacts,
  ctwaSessions,
  orderItems,
  orders,
  products,
} from "@/drizzle/schema";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatOrderWhen(d: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

type SearchParams = { contactId?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { contactId } = await searchParams;
  const filterContactId = contactId?.trim() || undefined;

  const orderListBase = db
    .select({
      id: orders.id,
      phone: contacts.phoneNumber,
      contactId: contacts.id,
      ctwa: ctwaSessions.ctwaClid,
      value: orders.value,
      currency: orders.currency,
      capiSent: orders.capiSent,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(contacts, eq(orders.contactId, contacts.id))
    .leftJoin(ctwaSessions, eq(orders.ctwaSessionId, ctwaSessions.id));

  const orderRows = await (filterContactId
    ? orderListBase.where(eq(orders.contactId, filterContactId))
    : orderListBase
  )
    .orderBy(desc(orders.createdAt))
    .limit(50);

  const orderIds = orderRows.map((o) => o.id);
  const itemRows =
    orderIds.length === 0
      ? []
      : await db
          .select({
            orderId: orderItems.orderId,
            productName: products.name,
            quantity: orderItems.quantity,
            lineValue: orderItems.lineValue,
          })
          .from(orderItems)
          .innerJoin(products, eq(orderItems.productId, products.id))
          .where(inArray(orderItems.orderId, orderIds));

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const row of itemRows) {
    const list = itemsByOrder.get(row.orderId) ?? [];
    list.push(row);
    itemsByOrder.set(row.orderId, list);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Recent orders
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Latest purchases and whether Meta CAPI received the event.
        </p>
        {filterContactId && orderRows[0] ? (
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Filtered by contact</span>{" "}
            <span className="font-mono text-xs">{orderRows[0].phone}</span> ·{" "}
            <Link
              className="text-primary underline underline-offset-2"
              href="/"
            >
              Clear filter
            </Link>
          </p>
        ) : filterContactId && orderRows.length === 0 ? (
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">
              No orders for this contact yet.
            </span>{" "}
            <Link className="underline underline-offset-2" href="/">
              Show all orders
            </Link>
          </p>
        ) : null}
      </div>
      <div className="-mx-3 overflow-x-auto sm:mx-0">
        <div className="inline-block min-w-full overflow-hidden rounded-xl border align-middle">
        <Table className="min-w-[36rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>CTWA</TableHead>
              <TableHead>Products</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>CAPI</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderRows.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={6}>
                  No orders yet. Create products, then record an order.
                </TableCell>
              </TableRow>
            ) : (
              orderRows.map((r) => {
                const items = itemsByOrder.get(r.id) ?? [];
                const productSummary =
                  items.length === 0
                    ? "—"
                    : items
                        .map(
                          (it) =>
                            `${it.productName} × ${it.quantity}`,
                        )
                        .join(", ");

                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {r.ctwa ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[320px] text-sm">
                      <span className="line-clamp-2" title={productSummary}>
                        {productSummary}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.currency} {String(r.value)}
                    </TableCell>
                    <TableCell>
                      {r.capiSent ? (
                        <Badge variant="default">sent</Badge>
                      ) : (
                        <Badge variant="secondary">pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-right text-xs">
                      {formatOrderWhen(r.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
