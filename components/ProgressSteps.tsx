"use client";

import { cn } from "@/lib/utils";

export interface Step {
  key: string;
  label: string;
}

export const MINT_STEPS: Step[] = [
  { key: "wallet", label: "Confirming transaction…" },
  { key: "logo", label: "Uploading logo…" },
  { key: "metadata", label: "Uploading metadata…" },
  { key: "mint", label: "Creating token…" },
  { key: "supply", label: "Minting supply…" },
  { key: "authorities", label: "Revoking authorities…" },
  { key: "complete", label: "Token created — sent to your wallet ✅" },
];

export default function ProgressSteps({
  steps,
  currentIndex,
  failedIndex,
}: {
  steps: Step[];
  currentIndex: number;
  failedIndex?: number | null;
}) {
  const total = steps.length;
  const isFailed = typeof failedIndex === "number" && failedIndex >= 0;
  const clampedIndex = Math.max(0, Math.min(currentIndex, total));
  const percent = Math.round((clampedIndex / total) * 100);

  const currentLabel = isFailed
    ? steps[failedIndex as number]?.label
    : currentIndex >= total
    ? "Complete ✅"
    : steps[Math.max(0, currentIndex)]?.label;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <p
          className={cn(
            "text-sm font-medium",
            isFailed ? "text-destructive" : "text-foreground"
          )}
        >
          {currentLabel}
        </p>
        <span
          className={cn(
            "font-mono text-sm font-semibold",
            isFailed ? "text-destructive" : "text-accent"
          )}
        >
          {percent}%
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/60">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            isFailed ? "bg-destructive" : "animated-gradient"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
