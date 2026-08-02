"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { CodeForgeSidebarNav, CodeForgeBrand } from "@/components/codeforge/sidebar-nav";

export function CodeForgeMobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open CodeForge menu" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-full max-w-[280px] translate-x-0 translate-y-0 overflow-y-auto rounded-none border-r data-[state=open]:animate-fade-in">
        <DialogTitle className="sr-only">CodeForge menu</DialogTitle>
        <DialogDescription className="sr-only">CodeForge navigation</DialogDescription>
        <div className="flex flex-col gap-6" onClick={() => setOpen(false)}>
          <CodeForgeBrand />
          <CodeForgeSidebarNav isAdmin={isAdmin} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
