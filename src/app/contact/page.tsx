import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = {
  title: "Contact",
  description: "Questions, feedback, or team plans — get in touch with the PromptForge team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="container py-20 max-w-lg">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Get in touch</h1>
      <p className="mt-4 text-text-muted">
        Questions, feedback, or team plans — we read every message.
      </p>
      <form className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <textarea
            id="message"
            name="message"
            rows={5}
            required
            className="flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          />
        </div>
        <Button type="submit" className="w-full">
          Send message
        </Button>
      </form>
    </div>
  );
}
