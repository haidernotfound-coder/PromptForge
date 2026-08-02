"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import type { AppSession } from "@/lib/session";

const NAV_LINKS = [
  { href: "/#products", label: "Products" },
  { href: "/products/promptforge", label: "PromptForge" },
  { href: "/about", label: "About" },
];

export function Navbar({ session }: { session: AppSession | null }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-colors",
        scrolled
          ? "border-border bg-bg/85 backdrop-blur-md"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          NexPrompt
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md text-text-muted transition-colors hover:text-text hover:bg-surface",
                pathname === link.href && "text-text"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <Button size="sm" asChild>
              <Link href="/">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Start forging</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </Dialog.Trigger>
            <AnimatePresence>
              {open && (
                <Dialog.Portal forceMount>
                  <Dialog.Overlay asChild forceMount>
                    <motion.div
                      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setOpen(false)}
                    />
                  </Dialog.Overlay>
                  <Dialog.Content asChild forceMount>
                    <motion.div
                      className="fixed right-0 top-0 z-50 h-full w-72 bg-surface-raised border-l border-border p-6 flex flex-col gap-6"
                      initial={{ x: "100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "100%" }}
                      transition={{ type: "spring", damping: 28, stiffness: 300 }}
                    >
                      <Dialog.Title className="font-display text-base font-semibold">
                        Menu
                      </Dialog.Title>
                      <Dialog.Description className="sr-only">
                        Site navigation
                      </Dialog.Description>
                      <nav className="flex flex-col gap-1" aria-label="Mobile">
                        {NAV_LINKS.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className="rounded-md px-3 py-2.5 text-sm font-medium text-text hover:bg-surface"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </nav>
                      <div className="mt-auto flex flex-col gap-2">
                        {session ? (
                          <Button asChild>
                            <Link href="/" onClick={() => setOpen(false)}>
                              Go to dashboard
                            </Link>
                          </Button>
                        ) : (
                          <>
                            <Button variant="outline" asChild>
                              <Link href="/login" onClick={() => setOpen(false)}>
                                Sign in
                              </Link>
                            </Button>
                            <Button asChild>
                              <Link href="/signup" onClick={() => setOpen(false)}>
                                Start forging
                              </Link>
                            </Button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  </Dialog.Content>
                </Dialog.Portal>
              )}
            </AnimatePresence>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
