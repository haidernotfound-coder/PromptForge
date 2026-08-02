import Link from "next/link";
import { Sparkles } from "lucide-react";

const FOOTER_LINKS = {
  Product: [
    { href: "/#products", label: "Products" },
    { href: "/products/promptforge", label: "PromptForge" },
    { href: "/products/codeforge", label: "CodeForge" },
  ],
  PromptForge: [
    { href: "/products/promptforge#features", label: "Features" },
    { href: "/products/promptforge#workflow", label: "Workflow" },
  ],
  Company: [
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ],
  Legal: [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-display text-base font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              NexPrompt
            </Link>
            <p className="mt-3 text-sm text-text-muted max-w-xs">
              One account, a growing forge of AI-powered tools — PromptForge and CodeForge,
              ready across every model.
            </p>
          </div>
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="font-display text-sm font-semibold text-text">{heading}</h3>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-muted hover:text-text transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="temper-line mt-10" />
        <p className="mt-6 text-xs text-text-faint">
          © {new Date().getFullYear()} NexPrompt. Building the future of AI productivity.
        </p>
      </div>
    </footer>
  );
}
