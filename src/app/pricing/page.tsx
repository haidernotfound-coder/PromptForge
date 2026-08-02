import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for NexPrompt — from a free tier for solo prompt engineers to team plans with shared collections and collaboration.",
  alternates: { canonical: "/pricing" },
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    description: "For getting your prompt library off the ground.",
    features: [
      "Up to 25 prompts",
      "2 folders",
      "3 tags",
      "AI improve",
      "Basic search",
      "AI assistant — 10 questions",
      "Community support",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/mo",
    description: "For prompt engineers who rely on this daily.",
    features: [
      "Unlimited prompts",
      "Unlimited folders",
      "Unlimited tags",
      "AI improve, expand, shorten, rewrite",
      "Unlimited AI assistant questions",
      "Full version history",
      "Public sharing links",
    ],
    cta: "Start forging",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$24",
    period: "/mo",
    description: "For teams sharing a common prompt library.",
    features: ["Everything in Pro", "Unlimited collections", "Role-based access", "Priority support"],
    cta: "Talk to us",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="container py-20">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Simple, honest pricing</h1>
        <p className="mt-4 text-text-muted">
          Start free. Upgrade when your prompt library outgrows the basics.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={cn(plan.highlighted && "border-accent shadow-lg relative")}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                Most popular
              </span>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="font-display text-3xl font-semibold">{plan.price}</span>
                {plan.period && <span className="text-sm text-text-muted">{plan.period}</span>}
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                    <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                {plan.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
