"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  Lightbulb,
  NotebookPen,
  Layers,
  ListChecks,
  PencilLine,
  CalendarClock,
  FileText,
  ScrollText,
  MessagesSquare,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/studyforge", label: "Overview", icon: LayoutDashboard },
  { href: "/studyforge/explain", label: "Explain Concepts", icon: Lightbulb },
  { href: "/studyforge/notes", label: "Notes Generator", icon: NotebookPen },
  { href: "/studyforge/flashcards", label: "Flashcards", icon: Layers },
  { href: "/studyforge/quiz", label: "Quiz Generator", icon: ListChecks },
  { href: "/studyforge/homework", label: "Homework Helper", icon: PencilLine },
  { href: "/studyforge/planner", label: "Study Planner", icon: CalendarClock },
  { href: "/studyforge/summarize", label: "Notes Summarizer", icon: FileText },
  { href: "/studyforge/exam", label: "Exam Practice", icon: ScrollText },
  { href: "/studyforge/chat", label: "AI Study Chat", icon: MessagesSquare },
  { href: "/studyforge/settings", label: "Settings", icon: Settings },
];

const ADMIN_LINK = { href: "/admin", label: "Admin", icon: ShieldCheck };

export function StudyForgeSidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;

  return (
    <nav className="flex flex-col gap-1" aria-label="StudyForge">
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

export function StudyForgeBrand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-base font-semibold">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <GraduationCap className="h-4 w-4" />
      </span>
      StudyForge
    </Link>
  );
}
