"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface Step {
  key: string;
  label: string;
}

export const MINT_STEPS: Step[] = [
  { key: "wallet", label: "Connexion du portefeuille" },
  { key: "logo", label: "Envoi du logo" },
  { key: "metadata", label: "Envoi des mÃ©tadonnÃ©es" },
  { key: "mint", label: "CrÃ©ation du mint" },
  { key: "supply", label: "Frappe de la supply" },
  { key: "authorities", label: "RÃ©vocation des autoritÃ©s" },
  { key: "complete", label: "TerminÃ©" },
];

/**
 * Shows the mint flow's progress one step at a time (instead of the full
 * checklist): a percentage/progress bar up top, and a single card below for
 * whichever step is relevant right now. When a step finishes it flashes a
 * checkmark + the updated percentage for a beat, then hands off to the next
 * step's card.
 */
export default function ProgressSteps({
  steps,
  currentIndex,
  failedIndex,
}: {
  steps: Step[];
  currentIndex: number; // index of the step currently in progress, -1 if not started
  failedIndex?: number | null;
}) {
  const total = steps.length;

  // The step actually shown on screen. Kept separate from `currentIndex` so
  // we can hold on a "done" checkmark briefly before advancing.
  const [displayIndex, setDisplayIndex] = useState(Math.max(currentIndex, 0));
  const [flashDone, setFlashDone] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (failedIndex != null) {
      setDisplayIndex(failedIndex);
      setFlashDone(false);
      return;
    }

    if (currentIndex > displayIndex) {
      setFlashDone(true);
      timeoutRef.current = setTimeout(() => {
        setDisplayIndex(currentIndex);
        setFlashDone(false);
      }, 550);
    } else if (currentIndex < displayIndex) {
      // Handles retry / reset: jump straight back without a flash.
      setDisplayIndex(Math.max(currentIndex, 0));
      setFlashDone(false);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, failedIndex]);

  const isFailed = failedIndex != null;
  const isAllDone = !isFailed && currentIndex >= total;

  const completedCount = flashDone ? displayIndex + 1 : displayIndex;
  const percent = isAllDone
    ? 100
    : Math.round((Math.max(0, Math.min(completedCount, total)) / total) * 100);

  const shownStep = isFailed ? steps[failedIndex] : isAllDone ? null : steps[Math.min(displayIndex, total - 1)];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {isAllDone ? "TerminÃ©" : isFailed ? "Ã‰chec" : "Progression"}
          </span>
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              isFailed ? "text-destructive" : "text-foreground"
            )}
          >
            {percent}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <motion.div
            className={cn("h-full rounded-full", isFailed ? "bg-destructive" : "bg-accent")}
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isAllDone ? (
          <motion.div
            key="all-done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 rounded-lg border border-accent bg-accent/10 px-4 py-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent bg-accent text-accent-foreground">
              <Check className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-foreground">Toutes les Ã©tapes sont terminÃ©es</p>
          </motion.div>
        ) : shownStep ? (
          <motion.div
            key={`${shownStep.key}-${flashDone ? "done" : "active"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3",
              isFailed
                ? "border-destructive bg-destructive/10"
                : flashDone
                ? "border-accent bg-accent/10"
                : "border-border bg-muted/30"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                isFailed
                  ? "border-destructive bg-destructive/20 text-destructive"
                  : flashDone
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-primary bg-primary/20 text-primary"
              )}
            >
              {isFailed ? (
                <X className="h-4 w-4" />
              ) : flashDone ? (
                <Check className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{shownStep.label}</p>
              <p className="text-xs text-muted-foreground">
                Ã‰tape {Math.min(displayIndex, total - 1) + 1} sur {total}
                {flashDone && !isFailed ? " â€” terminÃ©e" : ""}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
