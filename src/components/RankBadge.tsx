import { RANKS, type RankTier } from "@/lib/ranks";
import { cn } from "@/lib/utils";

export function RankBadge({
  tier, step, size = "md", className,
}: {
  tier: RankTier; step: number; size?: "sm" | "md" | "lg"; className?: string;
}) {
  const r = RANKS[tier];
  const Icon = r.icon;
  const dims = size === "sm" ? "text-[10px] px-1.5 py-0.5 gap-1" : size === "lg" ? "text-sm px-3 py-1.5 gap-1.5" : "text-xs px-2 py-1 gap-1";
  const iconSize = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <span
      className={cn("inline-flex items-center rounded-full font-semibold text-white shadow-card", dims, className)}
      style={{ background: `linear-gradient(135deg, ${r.color}, color-mix(in oklab, ${r.color} 70%, white))` }}
    >
      <Icon className={iconSize} />
      <span className="uppercase tracking-wide">{r.label}</span>
      <span className="opacity-80">·{step}</span>
    </span>
  );
}
