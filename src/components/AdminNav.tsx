"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/stores", label: "Stores" },
  { href: "/admin/managers", label: "Managers" },
  { href: "/admin/packers/new", label: "Add Packer" },
  { href: "/admin/roster", label: "Roster" },
  { href: "/admin/export", label: "Export" },
  { href: "/admin/history", label: "History" },
  { href: "/admin/audit", label: "Audit Log" },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="border-b bg-muted/30 overflow-x-auto">
      <div className="mx-auto max-w-7xl px-4 flex gap-1">
        {links.map(({ href, label, exact }) => (
          <Link
            key={href}
            href={href}
            className={`
              whitespace-nowrap px-3 py-2 text-sm transition-colors
              border-b-2 -mb-px
              ${isActive(href, exact)
                ? "border-foreground font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
              }
            `}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
