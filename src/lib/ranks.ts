import type { LucideIcon } from "lucide-react";
import { Sprout, Zap, Trophy, Gem, Crown } from "lucide-react";

export type RankTier = "normal" | "active" | "legend" | "pro" | "sure_plug";

export const RANKS: Record<RankTier, { label: string; color: string; icon: LucideIcon; tagline: string; index: number }> = {
  normal:    { label: "Normal",    color: "var(--color-rank-normal)",    icon: Sprout, tagline: "Just getting started", index: 0 },
  active:    { label: "Active",    color: "var(--color-rank-active)",    icon: Zap,    tagline: "Picking up steam",     index: 1 },
  legend:    { label: "Legend",    color: "var(--color-rank-legend)",    icon: Trophy, tagline: "Building reputation",  index: 2 },
  pro:       { label: "Pro",       color: "var(--color-rank-pro)",       icon: Gem,    tagline: "Elite contributor",    index: 3 },
  sure_plug: { label: "Sure Plug", color: "var(--color-rank-sure-plug)", icon: Crown,  tagline: "Top of the food chain", index: 4 },
};

export const ORDER: RankTier[] = ["normal", "active", "legend", "pro", "sure_plug"];

export const POSTS_PER_STEP = 10;
export const STEPS_PER_TIER = 5;

export function rankProgress(approvedPostCount: number) {
  const totalSteps = Math.min(Math.floor(approvedPostCount / POSTS_PER_STEP), 24);
  const tier = ORDER[Math.min(Math.floor(totalSteps / STEPS_PER_TIER), 4)];
  const step = (totalSteps % STEPS_PER_TIER) + 1;
  const postsInStep = approvedPostCount % POSTS_PER_STEP;
  const isMax = tier === "sure_plug" && step === 5;
  const toNext = isMax ? 0 : POSTS_PER_STEP - postsInStep;
  return { tier, step, postsInStep, toNext, pct: (postsInStep / POSTS_PER_STEP) * 100, isMax };
}

export function nextLevelLabel(tier: RankTier, step: number) {
  if (tier === "sure_plug" && step === 5) return "MAX rank achieved";
  if (step < 5) return `${RANKS[tier].label} ${step + 1}`;
  const nextTier = ORDER[ORDER.indexOf(tier) + 1];
  return `${RANKS[nextTier].label} 1`;
}

export function encouragement(approvedPostCount: number) {
  const lines = [
    "Keep posting — every drop fills the bucket.",
    "Your next post unlocks the next step. Let's go!",
    "Sure Plugs were once Normals. Stay consistent.",
    "Students are reading what you post. Don't stop now.",
    "One more drop and you level up.",
  ];
  return lines[approvedPostCount % lines.length];
}
