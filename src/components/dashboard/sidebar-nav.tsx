"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Library,
  Star,
  Settings,
  Sparkles,
  LayoutTemplate,
  FolderKanban,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/prompts", label: "Prompts", icon: Library },
  { href: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/dashboard/collections", label: "Collections", icon: FolderKanban },
  { href: "/dashboard/favorites", label: "Favorites", icon: Star },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const ADMIN_LINK = { href: "/dashboard/admin", label: "Admin", icon: ShieldCheck };

export function DashboardSidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;

  return (
    <nav className="flex flex-col gap-1" aria-label="Dashboard">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-text-muted hover:bg-surface hover:text-text"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardBrand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-base font-semibold">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Sparkles className="h-4 w-4" />
      </span>
      PromptForge
    </Link>
  );
}
