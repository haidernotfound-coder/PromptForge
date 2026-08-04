"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Shuffle,
  RotateCcw,
  Flag,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/lib/studyforge";

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Interactive, one-card-at-a-time deck — flip, prev/next, shuffle, and
 *  mark-as-difficult, in the spirit of Anki/Quizlet. Renders real
 *  `{ front, back }` card objects, never a markdown list. */
export function FlashcardDeck({ cards: initialCards }: { cards: Flashcard[] }) {
  const [order, setOrder] = React.useState<Flashcard[]>(initialCards);
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [difficult, setDifficult] = React.useState<Set<number>>(new Set());
  const [onlyDifficult, setOnlyDifficult] = React.useState(false);

  React.useEffect(() => {
    setOrder(initialCards);
    setIndex(0);
    setFlipped(false);
    setDifficult(new Set());
    setOnlyDifficult(false);
  }, [initialCards]);

  // Cards carry a stable identity (their position in `order`) so
  // "difficult" marks survive shuffling.
  const keyed = React.useMemo(() => order.map((card, i) => ({ card, key: i })), [order]);
  const visible = onlyDifficult ? keyed.filter((c) => difficult.has(c.key)) : keyed;

  const safeIndex = visible.length === 0 ? 0 : Math.min(index, visible.length - 1);
  const current = visible[safeIndex];

  function goto(next: number) {
    if (visible.length === 0) return;
    const clamped = ((next % visible.length) + visible.length) % visible.length;
    setIndex(clamped);
    setFlipped(false);
  }

  function shuffle() {
    setOrder((prev) => shuffleArray(prev));
    setIndex(0);
    setFlipped(false);
  }

  function reset() {
    setOrder(initialCards);
    setDifficult(new Set());
    setOnlyDifficult(false);
    setIndex(0);
    setFlipped(false);
  }

  function toggleDifficult() {
    if (!current) return;
    setDifficult((prev) => {
      const next = new Set(prev);
      if (next.has(current.key)) next.delete(current.key);
      else next.add(current.key);
      return next;
    });
  }

  if (order.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center text-sm text-text-muted">
        <Layers className="h-6 w-6 text-text-faint" />
        Run the tool to generate a flashcard deck.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Badge variant="slate" className="gap-1">
            <Layers className="h-3 w-3" /> {order.length} cards
          </Badge>
          {difficult.size > 0 && (
            <Badge variant="brass" className="gap-1">
              <Flag className="h-3 w-3" /> {difficult.size} marked difficult
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={onlyDifficult ? "brass" : "outline"}
            className="gap-1.5"
            onClick={() => {
              setOnlyDifficult((v) => !v);
              setIndex(0);
              setFlipped(false);
            }}
            disabled={difficult.size === 0 && !onlyDifficult}
          >
            <Flag className="h-3.5 w-3.5" />
            {onlyDifficult ? "Showing difficult" : "Review difficult"}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={shuffle}>
            <Shuffle className="h-3.5 w-3.5" /> Shuffle
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center text-sm text-text-muted">
          <Sparkles className="h-6 w-6 text-text-faint" />
          No cards marked difficult yet.
        </div>
      ) : (
        <>
          <div className="[perspective:1200px]">
            <button
              type="button"
              aria-label="Flip card"
              onClick={() => setFlipped((f) => !f)}
              className="relative block w-full min-h-[260px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.key + (onlyDifficult ? "-d" : "")}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="relative min-h-[260px]"
                >
                  <motion.div
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={{ duration: 0.45, ease: "easeInOut" }}
                    style={{ transformStyle: "preserve-3d" }}
                    className="relative min-h-[260px]"
                  >
                    {/* Front */}
                    <div
                      style={{ backfaceVisibility: "hidden" }}
                      className={cn(
                        "absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl border p-8 text-center",
                        difficult.has(current.key)
                          ? "border-brass/50 bg-brass/5"
                          : "border-border bg-surface-raised"
                      )}
                    >
                      <span className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
                        Question
                      </span>
                      <p className="font-display text-lg font-semibold leading-snug text-balance">
                        {current.card.front}
                      </p>
                      <span className="mt-2 text-xs text-text-faint">Tap to reveal answer</span>
                    </div>
                    {/* Back */}
                    <div
                      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                      className={cn(
                        "absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl border p-8 text-center",
                        difficult.has(current.key)
                          ? "border-brass/50 bg-brass/5"
                          : "border-accent/40 bg-accent/5"
                      )}
                    >
                      <span className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
                        Answer
                      </span>
                      <p className="text-base leading-relaxed text-balance">{current.card.back}</p>
                      <span className="mt-2 text-xs text-text-faint">Tap to flip back</span>
                    </div>
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => goto(safeIndex - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">
                {safeIndex + 1} / {visible.length}
              </span>
              <Button
                size="sm"
                variant={difficult.has(current.key) ? "brass" : "outline"}
                className="gap-1.5"
                onClick={toggleDifficult}
              >
                <Flag className="h-3.5 w-3.5" />
                {difficult.has(current.key) ? "Marked difficult" : "Mark difficult"}
              </Button>
            </div>

            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => goto(safeIndex + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
