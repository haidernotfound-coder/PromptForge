"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const backendConfigured = isSupabaseConfigured();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = (await supabase?.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })) ?? {};
    setLoading(false);
    // Always show the same "check your email" state regardless of whether
    // the address is registered — this avoids leaking which emails have
    // accounts. Only a genuine send failure (e.g. rate limit) surfaces.
    if (error && error.status !== 400) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (!backendConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password reset unavailable</CardTitle>
          <CardDescription>
            PromptForge is running in demo mode — there&apos;s no real account system, so there&apos;s
            no password to reset. Use &quot;Continue with demo account&quot; on the sign-in page instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your
            password. It&apos;s valid for a limited time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted">
            <Mail className="h-4 w-4 shrink-0" />
            Didn&apos;t get it? Check spam, or request another link in a minute.
          </div>
          <p className="mt-4 text-center text-sm text-text-muted">
            <Link href="/login" className="text-accent hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter the email on your account and we&apos;ll send you a link to set a new password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="text-center text-sm text-text-muted">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-accent hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
