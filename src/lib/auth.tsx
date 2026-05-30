import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_key: string;
  department_id: string | null;
  bio: string | null;
  rank_tier: "normal" | "active" | "legend" | "pro" | "sure_plug";
  rank_step: number;
  approved_post_count: number;
  show_online: boolean;
  credits: number;
  seen_welcome: boolean;
  is_verified: boolean;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string, email?: string | null, meta?: Record<string, any>) => {
    let { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!data) {
      const displayName =
        meta?.display_name || meta?.name || meta?.full_name || (email ? email.split("@")[0] : "Student");
      const referralCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      await supabase
        .from("profiles")
        .insert({ id: uid, display_name: displayName, email: email ?? null, referral_code: referralCode });
      const retry = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      data = retry.data;
    }
    setProfile((data as Profile | null) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => loadProfile(s.user.id, s.user.email, s.user.user_metadata), 0);
      else setProfile(null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id, data.session.user.email, data.session.user.user_metadata);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // online heartbeat — every 30s + on focus/visibility so "active now" stays accurate
  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    let alive = true;
    const beat = () => {
      if (!alive) return;
      void supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", uid);
    };
    beat();
    const t = setInterval(beat, 30_000);
    const onVis = () => { if (document.visibilityState === "visible") beat(); };
    window.addEventListener("focus", beat);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("focus", beat);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user]);

  // Realtime: keep profile fresh when credits/seen_welcome/rank change server-side
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`me-profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => setProfile(payload.new as Profile),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return (
    <Ctx.Provider
      value={{
        user, session, profile, loading,
        signOut: async () => { await supabase.auth.signOut(); },
        refreshProfile: async () => { if (user) await loadProfile(user.id); },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
