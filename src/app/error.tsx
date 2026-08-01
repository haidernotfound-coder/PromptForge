"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="container flex flex-col items-center justify-center py-32 text-center">
      <span className="font-mono text-sm text-danger">Error</span>
      <h1 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">
        Something went sideways
      </h1>
      <p className="mt-3 text-text-muted max-w-sm">
        An unexpected error interrupted this page. Your prompts and folders
        are safe — try again, or head back to the dashboard.
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="/dashboard">Back to dashboard</a>
        </Button>
      </div>
    </div>
  );
}
