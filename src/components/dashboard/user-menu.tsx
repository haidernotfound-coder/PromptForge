"use client";

import { useRouter } from "next/navigation";
import { LogOut, Sparkles, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutDemo } from "@/lib/demo-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import type { AppSession } from "@/lib/session";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "D") + (parts[1]?.[0] ?? "");
}

export function DashboardUserMenu({ session }: { session: AppSession }) {
  const router = useRouter();

  async function signOut() {
    if (session.isReal) {
      const supabase = getSupabaseBrowserClient();
      await supabase?.auth.signOut();
      useStore.getState().clearWorkspace();
    } else {
      logoutDemo();
    }
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Account menu"
        >
          <Avatar>
            <AvatarFallback>{initials(session.name).toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col">
          <span className="font-medium">{session.name}</span>
          <span className="text-xs font-normal text-text-muted">{session.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 opacity-70">
          {session.isReal ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {session.isReal ? "Signed in" : "Demo account"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-danger focus:text-danger"
          onSelect={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
