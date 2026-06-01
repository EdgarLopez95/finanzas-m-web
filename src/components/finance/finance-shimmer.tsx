import { cn } from "@/lib/utils";

type FinanceShimmerProps = {
  className?: string;
};

export function FinanceShimmer({ className }: FinanceShimmerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-[var(--fm-radius-card-medium)] bg-[var(--fm-surface-dark-alt)]",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(100deg,transparent,rgba(247,246,242,0.16),transparent)] before:animate-[shimmer_1.6s_infinite]",
        className
      )}
    />
  );
}