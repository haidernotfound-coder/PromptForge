import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center justify-center py-32 text-center">
      <span className="font-mono text-sm text-brass">404</span>
      <h1 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">
        This prompt doesn&apos;t exist
      </h1>
      <p className="mt-3 text-text-muted max-w-sm">
        The page you&apos;re looking for may have been moved, renamed, or never forged in the first place.
      </p>
      <Button className="mt-8" asChild>
        <Link href="/">Back to NexPrompt</Link>
      </Button>
    </div>
  );
}
