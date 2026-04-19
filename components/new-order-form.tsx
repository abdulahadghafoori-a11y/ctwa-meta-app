"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  getContactByPhone,
  type ContactLookup,
} from "@/actions/contact";
import { createOrder } from "@/actions/order";
import type { CtwaSessionRow } from "@/actions/ctwa";
import { getCtwaSessionsByPhone } from "@/actions/ctwa";
import type { ProductRow } from "@/actions/products";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { summarizeCtwaSessionLabel } from "@/lib/referral";
import { getPhonePresentation } from "@/lib/phone-display";
import { isReasonablePhoneDigits, normalizePhoneDigits } from "@/lib/phone-digits";
import {
  type NewOrderFormInput,
  newOrderFormSchema,
  orderStatuses,
} from "@/lib/validations/order";

type FormValues = NewOrderFormInput;

type ContactPhase =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "found"; contact: ContactLookup };

function formatTs(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function sessionTriggerLabel(s: CtwaSessionRow): string {
  const clid = s.ctwaClid?.slice(0, 12) ?? "—";
  return `${clid}… · ${formatTs(s.sendTime)}`;
}

function defaultLine(products: ProductRow[]) {
  const p = products[0];
  return {
    productId: p?.id ?? "",
    quantity: 1,
    unitSalePrice: p ? Number(p.defaultSalePrice) : 1,
  };
}

export function NewOrderForm({ products }: { products: ProductRow[] }) {
  const [sessions, setSessions] = useState<CtwaSessionRow[]>([]);
  const [loadingPhoneData, setLoadingPhoneData] = useState(false);
  const [contactPhase, setContactPhase] = useState<ContactPhase>({
    status: "idle",
  });
  const [pending, startTransition] = useTransition();
  const [noSessionConfirmOpen, setNoSessionConfirmOpen] = useState(false);
  const [pendingOrderValues, setPendingOrderValues] =
    useState<FormValues | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(newOrderFormSchema),
    defaultValues: {
      phone: "",
      ctwaSessionId: "",
      lines: [defaultLine(products)],
      status: "paid",
    },
  });

  const { setValue, control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });

  const phone = form.watch("phone");
  const ctwaSessionId = form.watch("ctwaSessionId");
  const lines = form.watch("lines");

  const selectedSession = sessions.find((s) => s.id === ctwaSessionId);

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = (phone ?? "").trim();
      if (!trimmed) {
        setSessions([]);
        setValue("ctwaSessionId", "");
        setContactPhase({ status: "idle" });
        return;
      }
      const digits = normalizePhoneDigits(trimmed);
      if (!isReasonablePhoneDigits(digits)) {
        setSessions([]);
        setValue("ctwaSessionId", "");
        setContactPhase({ status: "idle" });
        return;
      }
      setContactPhase({ status: "loading" });
      setLoadingPhoneData(true);
      void Promise.all([
        getCtwaSessionsByPhone(trimmed),
        getContactByPhone(trimmed),
      ])
        .then(([rows, contact]) => {
          setSessions(rows);
          setValue(
            "ctwaSessionId",
            rows.length > 0 ? (rows[0]?.id ?? "") : "",
          );
          if (contact) {
            setContactPhase({ status: "found", contact });
          } else {
            setContactPhase({ status: "not_found" });
          }
        })
        .finally(() => setLoadingPhoneData(false));
    }, 450);
    return () => clearTimeout(t);
  }, [phone, setValue]);

  useEffect(() => {
    if (contactPhase.status === "not_found") {
      form.setError("phone", {
        type: "manual",
        message:
          "No contact found for this number. The customer must reach you on WhatsApp first.",
      });
    } else {
      form.clearErrors("phone");
    }
  }, [contactPhase, form]);

  const orderTotal = useMemo(() => {
    return (lines ?? []).reduce((sum, line) => {
      const u = Number(line?.unitSalePrice);
      const q = Number.isFinite(line?.quantity) ? line.quantity : 1;
      if (!Number.isFinite(u) || u <= 0) return sum;
      return sum + u * q;
    }, 0);
  }, [lines]);

  const phoneDigits = useMemo(
    () => normalizePhoneDigits((phone ?? "").trim()),
    [phone],
  );
  const phoneOk = isReasonablePhoneDigits(phoneDigits);
  const contactPresentation =
    contactPhase.status === "found"
      ? getPhonePresentation(contactPhase.contact.phoneNumber)
      : null;
  const needsSessionPick = sessions.length > 0 && !ctwaSessionId;
  const submitDisabled =
    pending ||
    loadingPhoneData ||
    !phoneOk ||
    contactPhase.status !== "found" ||
    needsSessionPick;

  function runCreateOrder(values: FormValues) {
    startTransition(() => {
      void (async () => {
        const res = await createOrder({
          ...values,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.capiEventId) {
          toast.success(`Order ${res.orderId} created; CAPI event queued.`, {
            description: "Verify delivery in Meta Events Manager.",
            action: {
              label: "Open Events Manager",
              onClick: () =>
                window.open(
                  "https://business.facebook.com/events_manager2",
                  "_blank",
                ),
            },
          });
        } else {
          toast.success(`Order ${res.orderId} created.`, {
            description:
              "No CTWA session — Meta Purchase was not sent for this order.",
          });
        }
        form.reset({
          phone: values.phone,
          ctwaSessionId: sessions[0]?.id ?? "",
          lines: [defaultLine(products)],
          status: "paid",
        } satisfies FormValues);
      })();
    });
  }

  function onSubmit(values: FormValues) {
    if (contactPhase.status !== "found") {
      toast.error(
        "No contact found for this number. The customer must reach you on WhatsApp first.",
      );
      return;
    }
    if (sessions.length > 0 && !values.ctwaSessionId) {
      toast.error("Select a CTWA session.");
      return;
    }
    if (sessions.length === 0 && (phone ?? "").trim()) {
      setPendingOrderValues(values);
      setNoSessionConfirmOpen(true);
      return;
    }
    runCreateOrder(values);
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">New order</CardTitle>
        <CardDescription>
          The phone must match a contact already in the system (from WhatsApp).
          Link the sale to a CTWA session when available, then send a Purchase
          event to Meta. If there is no session for the number, you can still
          record the order after confirming.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            {/* Attribution: compact phone + flexible session */}
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Attribution
              </p>
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          className="h-9 font-mono text-sm tabular-nums"
                          placeholder="+1 555…"
                          autoComplete="tel"
                          inputMode="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ctwaSessionId"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>CTWA session</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!sessions.length || loadingPhoneData}
                      >
                        <FormControl>
                          <SelectTrigger
                            size="sm"
                            className="h-9 w-full min-w-0 max-w-full"
                          >
                            <SelectValue placeholder="Select session">
                              {selectedSession
                                ? sessionTriggerLabel(selectedSession)
                                : undefined}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sessions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <span className="block max-w-[min(100vw-4rem,28rem)] truncate">
                                {sessionTriggerLabel(s)} —{" "}
                                {summarizeCtwaSessionLabel(s)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Looks up the saved contact and CTWA sessions for this number.
              </p>
              {loadingPhoneData ? (
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Loading contact & sessions…
                </p>
              ) : null}
              {contactPhase.status === "found" && contactPresentation ? (
                <div className="bg-muted/50 space-y-2 rounded-lg border p-3 text-sm">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Contact
                  </p>
                  <dl className="grid gap-1.5 text-xs sm:grid-cols-2">
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-muted-foreground">Name</dt>
                      <dd className="font-medium">
                        {contactPhase.contact.name?.trim() || "—"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd className="font-mono tabular-nums">
                        {contactPresentation.formattedInternational}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Country</dt>
                      <dd>
                        {contactPhase.contact.countryName ??
                          contactPresentation.countryName ??
                          "—"}
                        {(contactPhase.contact.countryCode ??
                          contactPresentation.countryCode)
                          ? ` (${contactPhase.contact.countryCode ?? contactPresentation.countryCode})`
                          : null}
                      </dd>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-muted-foreground">In system since</dt>
                      <dd>
                        {formatTs(contactPhase.contact.createTime)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </div>

            <Separator />

            {/* Line items */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Products
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={!products.length}
                  onClick={() => append(defaultLine(products))}
                >
                  <PlusIcon className="mr-1 size-3.5" />
                  Add product
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((fieldRow, index) => {
                  const lineProductId = lines?.[index]?.productId;
                  const lineProduct = products.find((p) => p.id === lineProductId);
                  const lineUnit = Number(lines?.[index]?.unitSalePrice);
                  const lineQty = Number.isFinite(lines?.[index]?.quantity)
                    ? lines[index].quantity
                    : 1;
                  const lineSum =
                    Number.isFinite(lineUnit) && lineUnit > 0
                      ? lineUnit * lineQty
                      : 0;

                  return (
                    <div
                      key={fieldRow.id}
                      className="bg-muted/30 space-y-3 rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-muted-foreground text-xs">
                          Line {index + 1}
                        </span>
                        {fields.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive -mr-1 -mt-1"
                            onClick={() => remove(index)}
                            aria-label="Remove line"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                      <FormField
                        control={form.control}
                        name={`lines.${index}.productId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product</FormLabel>
                            <Select
                              onValueChange={(v) => {
                                field.onChange(v);
                                const p = products.find((x) => x.id === v);
                                if (p) {
                                  setValue(
                                    `lines.${index}.unitSalePrice`,
                                    Number(p.defaultSalePrice),
                                  );
                                }
                              }}
                              value={field.value}
                              disabled={!products.length}
                            >
                              <FormControl>
                                <SelectTrigger
                                  size="sm"
                                  className="h-9 w-full min-w-0 max-w-full"
                                >
                                  <SelectValue placeholder="Choose a product">
                                    {lineProduct ? (
                                      <span className="truncate font-medium">
                                        {lineProduct.name}
                                      </span>
                                    ) : undefined}
                                  </SelectValue>
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · USD {p.defaultSalePrice}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex flex-wrap items-end gap-3">
                        <FormField
                          control={form.control}
                          name={`lines.${index}.unitSalePrice`}
                          render={({ field }) => (
                            <FormItem className="w-[7.5rem] shrink-0">
                              <FormLabel className="text-xs">Unit (USD)</FormLabel>
                              <FormControl>
                                <Input
                                  className="h-9 font-mono text-sm tabular-nums"
                                  min={0}
                                  step="0.01"
                                  type="number"
                                  value={field.value}
                                  onBlur={field.onBlur}
                                  onChange={(e) =>
                                    field.onChange(
                                      Number.parseFloat(e.target.value || "0"),
                                    )
                                  }
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`lines.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem className="w-[5.5rem] shrink-0">
                              <FormLabel className="text-xs">Qty</FormLabel>
                              <FormControl>
                                <Input
                                  className="h-9 font-mono text-sm tabular-nums"
                                  min={1}
                                  step={1}
                                  type="number"
                                  value={field.value}
                                  onBlur={field.onBlur}
                                  onChange={(e) =>
                                    field.onChange(
                                      Number.parseInt(
                                        e.target.value || "1",
                                        10,
                                      ) || 1,
                                    )
                                  }
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="min-w-[8rem] flex-1 pb-2 pl-1">
                          <p className="text-muted-foreground text-xs">Line total</p>
                          <p className="text-base font-semibold tabular-nums">
                            {lineProduct ? `USD ${lineSum.toFixed(2)}` : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  Unit price defaults from the product; override for discounts.
                </p>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Order total</p>
                  <p className="text-lg font-semibold tabular-nums">
                    USD {orderTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Order details
              </p>
              <div className="max-w-[12rem]">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger size="sm" className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {orderStatuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button
              className="w-full sm:w-auto"
              disabled={submitDisabled}
              type="submit"
            >
              {pending ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Working…
                </>
              ) : sessions.length > 0 ? (
                "Create order & send CAPI event"
              ) : (
                "Create order"
              )}
            </Button>
          </form>
        </Form>

        <Dialog
          open={noSessionConfirmOpen}
          onOpenChange={(open) => {
            setNoSessionConfirmOpen(open);
            if (!open) setPendingOrderValues(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>No CTWA session for this number</DialogTitle>
              <DialogDescription>
                There are no WhatsApp referral sessions stored for this phone
                yet. You can still save this order without CTWA attribution. Meta
                Purchase will not be sent.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNoSessionConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const v = pendingOrderValues;
                  setNoSessionConfirmOpen(false);
                  setPendingOrderValues(null);
                  if (v) runCreateOrder(v);
                }}
              >
                Create order without session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
