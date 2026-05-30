import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Crown, Upload, GamepadIcon } from "lucide-react";

type Slide = {
  badge: string;
  title: string;
  body: string;
  cta?: { label: string; to: string };
  icon: ReactNode;
  gradient: string;
};

const slides: Slide[] = [
  {
    badge: "EBSU Student Hub",
    title: "Pass with flying colours.",
    body: "Past questions, assignments & notes — built by students, for students.",
    cta: { label: "Get started — it's free", to: "/login" },
    icon: <Sparkles className="w-3 h-3" />,
    gradient: "bg-hero",
  },
  {
    badge: "Rank up",
    title: "From Normal to Sure Plug",
    body: "Post 10 contents to climb each step. 5 tiers, 25 steps. Climb the leaderboard.",
    cta: { label: "View your rank", to: "/me" },
    icon: <Crown className="w-3 h-3" />,
    gradient: "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500",
  },
  {
    badge: "Share & earn",
    title: "Drop a past question.",
    body: "Type it out or upload the PDF — your coursemates will thank you.",
    cta: { label: "Post material", to: "/post/new" },
    icon: <Upload className="w-3 h-3" />,
    gradient: "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600",
  },
  {
    badge: "Break time",
    title: "Mini games & quizzes",
    body: "Puzzles, crossword & MCQs after every course past question.",
    cta: { label: "Play now", to: "/games" },
    icon: <GamepadIcon className="w-3 h-3" />,
    gradient: "bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-700",
  },
];

export function HeroCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);
  const dx = useRef(0);
  const [drag, setDrag] = useState(0);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  const onStart = (x: number) => { startX.current = x; setPaused(true); };
  const onMove = (x: number) => {
    if (startX.current == null) return;
    dx.current = x - startX.current;
    setDrag(dx.current);
  };
  const onEnd = () => {
    if (Math.abs(dx.current) > 60) {
      setI((v) => (v + (dx.current < 0 ? 1 : slides.length - 1)) % slides.length);
    }
    startX.current = null; dx.current = 0; setDrag(0);
    setTimeout(() => setPaused(false), 4000);
  };

  return (
    <section
      className="relative overflow-hidden rounded-3xl mb-6 select-none touch-pan-y"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false); onEnd(); }}
      onTouchStart={(e) => onStart(e.touches[0].clientX)}
      onTouchMove={(e) => onMove(e.touches[0].clientX)}
      onTouchEnd={onEnd}
      onMouseDown={(e) => onStart(e.clientX)}
      onMouseMove={(e) => startX.current != null && onMove(e.clientX)}
      onMouseUp={onEnd}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(calc(${-i * 100}% + ${drag}px))`, transitionDuration: drag ? "0ms" : "500ms" }}
      >
        {slides.map((s, idx) => (
          <div key={idx} className={`shrink-0 w-full ${s.gradient} text-white p-6 md:p-10 relative overflow-hidden`}>
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-white/15 px-3 py-1 rounded-full backdrop-blur">
                {s.icon}{s.badge}
              </span>
              <h2 className="mt-3 text-2xl md:text-5xl font-bold leading-tight font-display">{s.title}</h2>
              <p className="mt-3 text-sm md:text-lg opacity-90">{s.body}</p>
              {s.cta && (
                <Button asChild size="lg" variant="secondary" className="mt-5">
                  <Link to={s.cta.to}>{s.cta.label}</Link>
                </Button>
              )}
            </div>
            <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-10">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`Slide ${idx + 1}`}
            className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-white" : "w-1.5 bg-white/50"}`}
          />
        ))}
      </div>
    </section>
  );
}
