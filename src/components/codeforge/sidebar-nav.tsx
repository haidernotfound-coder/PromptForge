"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Code2,
  Wrench,
  Gauge,
  BookOpenText,
  Repeat,
  FlaskConical,
  FileText,
  ClipboardCheck,
  MessagesSquare,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/codeforge", label: "Overview", icon: LayoutDashboard },
  { href: "/codeforge/generate", label: "Generate Code", icon: Code2 },
  { href: "/codeforge/fix-bugs", label: "Fix Bugs", icon: Wrench },
  { href: "/codeforge/optimize", label: "Optimize Code", icon: Gauge },
  { href: "/codeforge/explain", label: "Explain Code", icon: BookOpenText },
  { href: "/codeforge/convert", label: "Convert Languages", icon: Repeat },
  { href: "/codeforge/tests", label: "Generate Unit Tests", icon: FlaskConical },
  { href: "/codeforge/docs", label: "Generate Documentation", icon: FileText },
  { href: "/codeforge/review", label: "Review Code", icon: ClipboardCheck },
  { href: "/codeforge/chat", label: "AI Coding Chat", icon: MessagesSquare },
  { href: "/codeforge/settings", label: "Settings", icon: Settings },
];

const ADMIN_LINK = { href: "/admin", label: "Admin", icon: ShieldCheck };

export function CodeForgeSidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;

  return (
    <nav className="flex flex-col gap-1" aria-label="CodeForge">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface hover:text-text"
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

export function CodeForgeBrand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-base font-semibold">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Code2 className="h-4 w-4" />
      </span>
      CodeForge
    </Link>
  );
}
