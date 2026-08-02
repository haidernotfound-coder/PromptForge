"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleIcon } from "@/components/ui/google-icon";
import { loginDemo } from "@/lib/demo-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const backendConfigured = isSupabaseConfigured();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = React.useState(false);

  function enterDemo(overrides?: { name?: string; email?: string }) {
    setLoading(true);
    loginDemo(overrides);
    router.push("/promptforge");
    router.refresh();
  }

  async function signUpReal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = (await supabase?.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/promptforge`,
      },
    })) ?? {};
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmations are off, Supabase returns an active session
    // immediately and we can go straight to the dashboard. Otherwise, tell
    // the person to check their inbox.
    if (data?.session) {
      router.push("/promptforge");
      router.refresh();
    } else {
      setConfirmationSent(true);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = (await supabase?.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/promptforge` },
    })) ?? {};
    if (error) {
      setLoading(false);
      setError(error.message);
    }
  }

  if (confirmationSent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account, then come back and sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted">
            <Mail className="h-4 w-4 shrink-0" />
            Didn&apos;t get it? Check spam, or try signing up again in a minute.
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
        <CardTitle>Start forging</CardTitle>
        <CardDescription>
          {backendConfigured
            ? "Create your NexPrompt account — it's free."
            : "NexPrompt is running in demo mode — creating an account just opens the shared demo workspace, no credit card or real signup required."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {backendConfigured && (
          <>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              disabled={loading}
              onClick={signInWithGoogle}
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </Button>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-text-faint">or</span>
              <Separator className="flex-1" />
            </div>
          </>
        )}
        {!backendConfigured && (
          <>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              disabled={loading}
              onClick={() => enterDemo()}
            >
              <Sparkles className="h-4 w-4" />
              Continue with demo account
            </Button>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-text-faint">or</span>
              <Separator className="flex-1" />
            </div>
          </>
        )}
        <form
          className="space-y-4"
          onSubmit={backendConfigured ? signUpReal : (e) => { e.preventDefault(); enterDemo({ name, email }); }}
        >
          {error && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Ada Lovelace"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={backendConfigured ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={backendConfigured}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
        {backendConfigured && (
          <p className="text-center text-xs text-text-faint">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="hover:underline">Terms</Link> and{" "}
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
