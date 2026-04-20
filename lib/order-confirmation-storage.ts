/** sessionStorage payload after createOrder (not persisted in DB). */
export type OrderConfirmClientPayload = {
  capiPayloadJson: string;
  capiSent: boolean;
  capiError: string | null;
  capiEventId: string;
};

export function orderConfirmStorageKey(orderId: string): string {
  return `ctwa_order_confirm_${orderId}`;
}
