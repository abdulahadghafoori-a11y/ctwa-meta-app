import { ProductForm } from "@/components/product-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listProducts } from "@/actions/products";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const productRows = await listProducts();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground text-sm">
          Catalog used when creating orders and CAPI item payloads. All amounts are USD.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add product</CardTitle>
          <CardDescription>SKU is generated automatically when you save.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm />
        </CardContent>
      </Card>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Default sale</TableHead>
              <TableHead className="text-right">COGS</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productRows.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={5}>
                  No products yet.
                </TableCell>
              </TableRow>
            ) : (
              productRows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="text-right">
                    USD {p.defaultSalePrice}
                  </TableCell>
                  <TableCell className="text-right">USD {p.cogs}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {p.createdAt}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
