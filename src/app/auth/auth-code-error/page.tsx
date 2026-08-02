import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Link expired", robots: { index: false, follow: false } };

export default function AuthCodeErrorPage() {
  return (
    <div className="container flex min-h-[calc(100vh-8rem)] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-display text-lg font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          NexPrompt
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>That link didn&apos;t work</CardTitle>
            <CardDescription>
              It may have expired or already been used. Sign-up confirmation and password-reset links
              are single-use.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/login">Back to sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/forgot-password">Request a new password reset link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
