import Link from "next/link";

import { Separator } from "@/components/ui/separator";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/orders/new", label: "New order" },
  { href: "/products", label: "Products" },
];

export function SiteHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <Link className="font-semibold tracking-tight" href="/">
          CTWA Orders
        </Link>
        <Separator className="hidden h-6 sm:block" orientation="vertical" />
        <nav className="flex flex-wrap gap-4 text-sm">
          {links.map((l) => (
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              href={l.href}
              key={l.href}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
