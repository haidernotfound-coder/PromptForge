"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Lands here after /auth/callback exchanges the emailed reset-password link
 * for a temporary "recovery" session. That session is enough to call
 * `updateUser({ password })` — no need to know the old password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const backendConfigured = isSupabaseConfigured();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!backendConfigured) return;
    const supabase = getSupabaseBrowserClient();
    supabase?.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
  }, [backendConfigured]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = (await supabase?.auth.updateUser({ password })) ?? {};
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/promptforge");
    router.refresh();
  }

  if (!backendConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password reset unavailable</CardTitle>
          <CardDescription>NexPrompt is running in demo mode — there&apos;s no real account to reset.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm text-accent hover:underline">Back to sign in</Link>
        </CardContent>
      </Card>
    );
  }

  if (hasSession === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This link has expired</CardTitle>
          <CardDescription>
            Reset links are single-use and time-limited. Request a new one to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password" className="text-sm text-accent hover:underline">
            Request a new reset link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
