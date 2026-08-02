"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleIcon } from "@/components/ui/google-icon";
import { loginDemo } from "@/lib/demo-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const backendConfigured = isSupabaseConfigured();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function enterDemo(overrides?: { email?: string }) {
    setLoading(true);
    loginDemo({ email: overrides?.email });
    router.push(next);
    router.refresh();
  }

  async function signInReal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = (await supabase?.auth.signInWithPassword({ email, password })) ?? {};
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = (await supabase?.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
    })) ?? {};
    if (error) {
      setLoading(false);
      setError(error.message);
    }
    // On success Supabase redirects the browser to Google, then back to
    // /auth/callback — no client-side navigation needed here.
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          {backendConfigured
            ? "Sign in to get back to your prompts."
            : "Sign in to get back to your prompts. NexPrompt is running in demo mode — any credentials sign you into the same shared demo account."}
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
          onSubmit={backendConfigured ? signInReal : (e) => { e.preventDefault(); enterDemo({ email }); }}
        >
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {backendConfigured && (
                <Link href="/forgot-password" className="text-xs text-accent hover:underline">
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={backendConfigured}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-sm text-text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
