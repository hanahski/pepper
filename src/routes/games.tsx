import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Puzzle, Grid3x3 } from "lucide-react";

export const Route = createFileRoute("/games")({ component: GamesPage });

function GamesPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold font-display mb-1">Mini-games</h1>
      <p className="text-muted-foreground mb-6">Take a break between study sessions.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/games/puzzle" className="group bg-card border rounded-2xl p-6 shadow-card hover:shadow-glow hover:-translate-y-0.5 transition-all">
          <Puzzle className="w-10 h-10 text-primary mb-3" />
          <h2 className="font-bold text-lg group-hover:text-primary">Sliding Puzzle</h2>
          <p className="text-sm text-muted-foreground mt-1">Arrange the 3×3 tiles in order.</p>
        </Link>
        <div className="bg-card border-2 border-dashed rounded-2xl p-6 opacity-60">
          <Grid3x3 className="w-10 h-10 text-muted-foreground mb-3" />
          <h2 className="font-bold text-lg">Crossword</h2>
          <p className="text-sm text-muted-foreground mt-1">Coming soon — university-themed clues.</p>
        </div>
      </div>
    </AppShell>
  );
}
