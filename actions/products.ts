"use server";

import { desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";

import { products } from "@/drizzle/schema";
import { db } from "@/lib/db";

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  defaultSalePrice: string;
  cogs: string;
  description: string | null;
  createdAt: string;
};

const createProductSchema = z.object({
  name: z.string().min(1),
  defaultSalePrice: z.number().positive(),
  cogs: z.number().nonnegative(),
  description: z.string().optional(),
});

function generateSku(): string {
  return `PRD-${nanoid(12)}`;
}

function isPostgresUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "23505"
  );
}

export async function listProducts(): Promise<ProductRow[]> {
  const rows = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt));

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    defaultSalePrice: String(p.defaultSalePrice),
    cogs: String(p.cogs),
    description: p.description,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function createProduct(
  input: z.infer<typeof createProductSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, defaultSalePrice, cogs, description } = parsed.data;

  const values = {
    name,
    defaultSalePrice: String(defaultSalePrice),
    cogs: String(cogs),
    description: description?.trim() ? description : null,
  };

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await db.insert(products).values({
        ...values,
        sku: generateSku(),
      });
      break;
    } catch (e) {
      if (isPostgresUniqueViolation(e) && attempt < 7) {
        continue;
      }
      console.error(e);
      return {
        ok: false,
        error: "Could not create product. Try again.",
      };
    }
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/orders/new");
  return { ok: true };
}
