import { z } from "zod";

export const orderStatuses = [
  "pending",
  "paid",
  "shipped",
  "cancelled",
] as const;

export const APP_CURRENCY = "USD" as const;

const ctwaSessionIdField = z.union([
  z.string().uuid(),
  z.literal(""),
]);

const orderLineSchema = z.object({
  productId: z.string().uuid(),
  unitSalePrice: z.number().positive(),
  quantity: z.number().int().min(1).max(99_999),
});

export const createOrderSchema = z.object({
  phone: z.string().min(6),
  ctwaSessionId: ctwaSessionIdField,
  lines: z.array(orderLineSchema).min(1).max(50),
  orderId: z.string().optional(),
  status: z.enum(orderStatuses),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Client form: internal order id is always generated server-side. */
export const newOrderFormSchema = createOrderSchema.omit({ orderId: true });
export type NewOrderFormInput = z.infer<typeof newOrderFormSchema>;
