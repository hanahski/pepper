import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PartyPopper, Gift, Coins, X } from "lucide-react";

/**
 * Listens to the referrals table; whenever the signed-in user gets credited as an inviter,
 * pop a celebratory in-app notification. Triggers ONLY on a referral the user actually made.
 */
export function ReferralCelebration() {
  const { user } = useAuth();
  const [event, setEvent] = useState<{ id: string; inviteeName: string } | null>(null);
  const [closing, setClosing] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`referrals-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "referrals", filter: `inviter_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as { id: string; invitee_id: string };
          if (seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);
          const { data: invitee } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", row.invitee_id)
            .maybeSingle();
          setEvent({ id: row.id, inviteeName: invitee?.display_name ?? "a new student" });
          setClosing(false);
          // auto-dismiss after 6s
          setTimeout(() => setClosing(true), 5800);
          setTimeout(() => setEvent(null), 6400);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        left: 40 + Math.random() * 20,
        delay: Math.random() * 0.4,
        rotate: Math.random() * 360,
        hue: ["#ff5d8f", "#ffb830", "#7bdff2", "#a78bfa", "#86efac"][i % 5],
      })),
    [event?.id],
  );

  if (!event) return null;

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => setEvent(null), 400);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed z-[90] left-1/2 -translate-x-1/2 top-20 w-[92vw] max-w-sm transition-all duration-400 ${
        closing ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
      }`}
      style={{ animation: !closing ? "refIn 600ms cubic-bezier(0.34, 1.56, 0.64, 1)" : undefined }}
    >
      <div className="relative bg-card border-2 border-primary/50 rounded-2xl shadow-glow p-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="absolute top-0 rounded-sm"
              style={{
                left: `${c.left}%`,
                width: 8,
                height: 4,
                background: c.hue,
                transform: `rotate(${c.rotate}deg)`,
                animation: `refFall 2.2s ${c.delay}s ease-in forwards`,
              }}
            />
          ))}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted text-muted-foreground z-10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-start gap-3 relative">
          <div
            className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center shrink-0 shadow-glow"
            style={{ animation: "refBob 1s ease-in-out infinite" }}
          >
            <PartyPopper className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1">
              <Gift className="w-3 h-3" /> Referral success
            </div>
            <p className="font-bold font-display text-sm leading-tight mt-0.5">
              {event.inviteeName} joined with your code!
            </p>
            <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
              You earned <Coins className="w-3 h-3 text-primary" /> <strong className="text-primary">+100 credits</strong>
            </p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes refIn {
          0%   { transform: translate(-50%, -40px) scale(0.7); opacity: 0; }
          70%  { transform: translate(-50%, 4px) scale(1.04); opacity: 1; }
          100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        @keyframes refBob {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50%      { transform: translateY(-4px) rotate(6deg); }
        }
        @keyframes refFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(140px) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
