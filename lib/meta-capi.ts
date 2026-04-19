/**
 * Meta Conversions API (Graph) — server-side Purchase for Click to WhatsApp attribution.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 *
 * Alternative (often simpler operationally): use YCloud’s Custom Event / forwarding so YCloud
 * calls Meta with your pixel + access token, and this app only records orders in Postgres.
 * Switch by removing `sendMetaPurchaseEvent` from the server action and wiring YCloud’s UI instead.
 */

import { nanoid } from "nanoid";

import { hashPhoneForMeta } from "@/lib/phone";

const GRAPH_API_VERSION = "v21.0";

export type MetaPurchaseLineItem = {
  sku: string;
  productName: string;
  quantity: number;
  /** Line total (value) for this SKU */
  lineValue: number;
};

export type MetaPurchaseParams = {
  /** Your internal order id (also sent as custom_data.order_id). */
  orderId: string;
  /** Total order value (major currency units). */
  value: number;
  currency: string;
  /** Sum of item quantities (for num_items if needed). */
  totalQuantity: number;
  lines: MetaPurchaseLineItem[];
  /** Exact CTWA click id chosen in the UI — included in custom_data for attribution. */
  ctwaClid: string;
  /** Digits-only phone (same normalization as hashing). */
  phoneDigits: string;
};

export type MetaPurchaseResult = {
  eventId: string;
};

export async function sendMetaPurchaseEvent(
  params: MetaPurchaseParams,
): Promise<MetaPurchaseResult> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    throw new Error("META_PIXEL_ID and META_ACCESS_TOKEN must be set");
  }

  const eventId = nanoid();
  const eventTime = Math.floor(Date.now() / 1000);
  const ph = hashPhoneForMeta(params.phoneDigits);

  const url = new URL(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`,
  );
  url.searchParams.set("access_token", accessToken);
  if (process.env.META_TEST_EVENT_CODE) {
    url.searchParams.set("test_event_code", process.env.META_TEST_EVENT_CODE);
  }

  const contents = params.lines.map((line) => {
    const unitPrice =
      line.quantity > 0 ? line.lineValue / line.quantity : line.lineValue;
    return {
      id: line.sku,
      quantity: line.quantity,
      item_price: unitPrice,
      title: line.productName,
    };
  });

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: eventTime,
        event_id: eventId,
        action_source: "business_messaging",
        messaging_channel: "whatsapp",
        user_data: {
          ph,
        },
        custom_data: {
          currency: params.currency,
          value: params.value,
          order_id: params.orderId,
          ctwa_clid: params.ctwaClid,
          num_items: params.totalQuantity,
          contents,
        },
      },
    ],
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    events_received?: number;
  };

  if (!res.ok) {
    const msg =
      typeof json.error?.message === "string"
        ? json.error.message
        : `Meta API error (${res.status})`;
    throw new Error(msg);
  }

  return { eventId };
}
