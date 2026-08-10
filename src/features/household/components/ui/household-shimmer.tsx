import { cn } from "@/lib/utils";

type HouseholdShimmerProps = {
  className?: string;
};

export function HouseholdShimmer({ className }: HouseholdShimmerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-[20px] bg-[var(--hh-surface-elevated)]",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(100deg,transparent,var(--hh-border-soft),transparent)] before:animate-[shimmer_1.6s_infinite]",
        className
      )}
    />
  );
}
