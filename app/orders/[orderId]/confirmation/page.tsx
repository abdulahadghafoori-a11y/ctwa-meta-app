import { notFound } from "next/navigation";

import { getOrderConfirmation } from "@/actions/order";
import { OrderConfirmationClient } from "@/components/order-confirmation-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

export default async function OrderConfirmationPage({ params }: Props) {
  const { orderId } = await params;
  const data = await getOrderConfirmation(orderId);
  if (!data) {
    notFound();
  }

  return <OrderConfirmationClient orderId={orderId} data={data} />;
}
