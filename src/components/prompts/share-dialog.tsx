"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Globe2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ShareDialog({
  open,
  onOpenChange,
  kind,
  isPublic,
  onSetPublic,
  path,
  itemLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "prompt" | "collection";
  isPublic: boolean;
  onSetPublic: (value: boolean) => void;
  /** public route path, e.g. /share/abc123 */
  path: string;
  itemLabel: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  React.useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {kind}</DialogTitle>
          <DialogDescription>
            Anyone with the link can view a read-only copy of &ldquo;{itemLabel}&rdquo;. Nothing
            leaves this browser — this is a demo-mode link that only resolves for people using the
            same browser and device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div className="flex items-center gap-2.5">
            {isPublic ? (
              <Globe2 className="h-4 w-4 text-accent" />
            ) : (
              <Lock className="h-4 w-4 text-text-faint" />
            )}
            <div>
              <p className="text-sm font-medium">{isPublic ? "Public" : "Private"}</p>
              <p className="text-xs text-text-faint">
                {isPublic ? "Visible to anyone with the link" : "Only visible to you"}
              </p>
            </div>
          </div>
          <Switch
            checked={isPublic}
            onCheckedChange={onSetPublic}
            aria-label={isPublic ? "Make private" : "Make public"}
          />
        </div>

        {isPublic && (
          <div className="space-y-1.5">
            <Label htmlFor="share-link">Link</Label>
            <div className="flex gap-2">
              <Input id="share-link" readOnly value={url} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy link"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  toast.success("Link copied to clipboard");
                }}
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
