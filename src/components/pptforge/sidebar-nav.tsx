"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Presentation, History, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/pptforge", label: "Generate", icon: LayoutDashboard },
  { href: "/pptforge/history", label: "History", icon: History },
  { href: "/pptforge/settings", label: "Settings", icon: Settings },
];

const ADMIN_LINK = { href: "/admin", label: "Admin", icon: ShieldCheck };

export function PptForgeSidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;

  return (
    <nav className="flex flex-col gap-1" aria-label="PPTForge">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ease-smooth",
              active
                ? "bg-accent-soft text-accent"
                : "text-text-muted hover:bg-surface hover:text-text hover:translate-x-0.5"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
            )}
            <link.icon className={cn("h-4 w-4 transition-transform", !active && "group-hover:scale-110")} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PptForgeBrand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-base font-semibold">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500 text-white">
        <Presentation className="h-4 w-4" />
      </span>
      PPTForge
    </Link>
  );
}
