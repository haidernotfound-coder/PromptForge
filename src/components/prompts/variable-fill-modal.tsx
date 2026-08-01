"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  inferVariableField,
  humanizeVariableName,
  substituteVariables,
} from "@/lib/prompt-variables";

export function VariableFillModal({
  open,
  onOpenChange,
  body,
  variables,
  actionLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  body: string;
  variables: string[];
  /** e.g. "Improve", "Rewrite (Casual)" — shown on the confirm button. */
  actionLabel: string;
  onConfirm: (filledBody: string) => void;
}) {
  const fields = React.useMemo(() => variables.map(inferVariableField), [variables]);
  const [values, setValues] = React.useState<Record<string, string>>({});

  // Reset the form fresh each time the modal opens for a new set of
  // variables, rather than carrying over stale values between prompts.
  React.useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(variables.map((v) => [v, ""])));
    }
  }, [open, variables]);

  const preview = React.useMemo(() => substituteVariables(body, values), [body, values]);
  const allFilled = variables.every((v) => values[v]?.trim());

  function handleConfirm() {
    if (!allFilled) return;
    onConfirm(substituteVariables(body, values));
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  className="w-full max-w-2xl rounded-lg border border-border bg-surface-raised shadow-lg flex flex-col max-h-[85vh]"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                >
                  <div className="flex items-start justify-between gap-4 p-6 pb-4">
                    <div>
                      <Dialog.Title className="font-display text-base font-semibold flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-accent" /> Fill in variables
                      </Dialog.Title>
                      <Dialog.Description className="mt-1 text-sm text-text-muted">
                        This prompt has {variables.length} variable{variables.length === 1 ? "" : "s"}. Fill
                        them in so {actionLabel} runs against the real content.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Close">
                        <X className="h-4 w-4" />
                      </Button>
                    </Dialog.Close>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 overflow-y-auto px-6 pb-4">
                    <div className="space-y-4">
                      {fields.map((field) => (
                        <div key={field.name} className="space-y-1.5">
                          <Label htmlFor={`var-${field.name}`} className="text-xs text-text-faint capitalize">
                            {humanizeVariableName(field.name)}
                          </Label>
                          {field.type === "select" ? (
                            <Select
                              value={values[field.name] ?? ""}
                              onValueChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v }))}
                            >
                              <SelectTrigger id={`var-${field.name}`} className="h-9 text-sm">
                                <SelectValue placeholder={`Choose ${humanizeVariableName(field.name)}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options?.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.type === "textarea" ? (
                            <Textarea
                              id={`var-${field.name}`}
                              value={values[field.name] ?? ""}
                              onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                              placeholder={field.placeholder}
                              className="min-h-[70px] text-sm"
                            />
                          ) : (
                            <Input
                              id={`var-${field.name}`}
                              type={field.type}
                              value={values[field.name] ?? ""}
                              onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                              placeholder={field.placeholder}
                              className="h-9 text-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <p className="text-xs font-medium text-text-faint">Live preview</p>
                      <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 font-mono text-xs text-text-muted max-h-72 overflow-y-auto">
                        {preview}
                      </pre>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 p-6 pt-4 border-t border-border">
                    <Dialog.Close asChild>
                      <Button variant="outline" size="sm">
                        Cancel
                      </Button>
                    </Dialog.Close>
                    <Button size="sm" className="gap-1.5" disabled={!allFilled} onClick={handleConfirm}>
                      <Sparkles className="h-3.5 w-3.5" /> Run {actionLabel}
                    </Button>
                  </div>
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
