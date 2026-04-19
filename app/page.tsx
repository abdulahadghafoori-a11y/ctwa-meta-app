import { desc, eq, inArray } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orderItems, orders, products } from "@/drizzle/schema";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const orderRows = await db
    .select({
      id: orders.id,
      phone: orders.phoneNumber,
      ctwa: orders.ctwaClid,
      value: orders.value,
      currency: orders.currency,
      capiSent: orders.capiSent,
      createdAt: orders.createdAt,
    })
    .from(orders)
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
        <h1 className="text-2xl font-semibold tracking-tight">Recent orders</h1>
        <p className="text-muted-foreground text-sm">
          Latest purchases and whether Meta CAPI received the event.
        </p>
      </div>
      <div className="rounded-xl border">
        <Table>
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
                    <TableCell className="text-muted-foreground text-right text-xs">
                      {r.createdAt.toISOString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
