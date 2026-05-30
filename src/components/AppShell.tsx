import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AvatarDisplay } from "./AvatarDisplay";
import { Button } from "@/components/ui/button";
import { Home, Library, LogIn, MessageCircle, Newspaper, PlusCircle, ScanLine, Search as SearchIcon, Shield, ShoppingBag, User, X } from "lucide-react";
import { Logo } from "./Logo";
import { SiteSearch } from "./SiteSearch";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WelcomeOverlay } from "./WelcomeOverlay";
import { ReferralCelebration } from "./ReferralCelebration";

function useUnreadChatCount(userId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) { setCount(0); return; }
    let alive = true;

    const compute = async () => {
      // Threads I'm in (1:1 + groups)
      const [{ data: oneRows }, { data: memberRows }] = await Promise.all([
        supabase.from("dm_threads").select("id,last_message_at").or(`user_a.eq.${userId},user_b.eq.${userId}`).limit(200),
        supabase.from("dm_thread_members").select("thread_id").eq("user_id", userId).limit(200),
      ]);
      const memberIds = (memberRows ?? []).map((r) => r.thread_id);
      let groupRows: any[] = [];
      if (memberIds.length) {
        const { data } = await supabase
          .from("dm_threads")
          .select("id,last_message_at")
          .in("id", memberIds);
        groupRows = data ?? [];
      }
      const all = [...(oneRows ?? []), ...groupRows];
      if (!all.length) { if (alive) setCount(0); return; }
      const { data: reads } = await supabase
        .from("dm_thread_reads")
        .select("thread_id,last_read_at")
        .eq("user_id", userId)
        .in("thread_id", all.map((t) => t.id));
      const readMap = new Map((reads ?? []).map((r: any) => [r.thread_id, r.last_read_at]));
      let n = 0;
      for (const t of all) {
        const last = readMap.get(t.id);
        if (!last || new Date(t.last_message_at) > new Date(last)) n++;
      }
      if (alive) setCount(n);
    };

    compute();
    const ch = supabase
      .channel(`unread-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () => compute())
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_threads" }, () => compute())
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_thread_reads", filter: `user_id=eq.${userId}` }, () => compute())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [userId]);

  return count;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [mobileSearch, setMobileSearch] = useState(false);
  const unread = useUnreadChatCount(user?.id);
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });
  return (
    <div className="min-h-screen flex flex-col">
      <WelcomeOverlay />
      <ReferralCelebration />
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <Logo size={32} />
            <span className="hidden sm:inline text-gradient font-display tracking-tight">StudentsPlug</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-1 ml-2 text-sm">
            <Link to="/" className="px-3 py-1.5 rounded-md hover:bg-muted">Feed</Link>
            <Link to="/blog" className="px-3 py-1.5 rounded-md hover:bg-muted">Daily</Link>
            <Link to="/faculties" className="px-3 py-1.5 rounded-md hover:bg-muted">Catalog</Link>
            <Link to="/market" className="px-3 py-1.5 rounded-md hover:bg-muted">Market</Link>
            <Link to="/courses" className="px-3 py-1.5 rounded-md hover:bg-muted">Courses</Link>
            <Link to="/chat" className="px-3 py-1.5 rounded-md hover:bg-muted relative">
              Chat
              {unread > 0 && <UnreadDot count={unread} />}
            </Link>
            <Link to="/tools" className="px-3 py-1.5 rounded-md hover:bg-muted">Tools</Link>
            <Link to="/games" className="px-3 py-1.5 rounded-md hover:bg-muted">Games</Link>
            {isAdmin && <Link to="/admin" className="px-3 py-1.5 rounded-md hover:bg-muted text-primary font-semibold flex items-center gap-1"><Shield className="w-3.5 h-3.5" />Admin</Link>}
          </nav>
          <div className="hidden md:flex flex-1 max-w-md mx-2">
            <SiteSearch />
          </div>
          <div className="md:hidden flex-1" />
          <button
            type="button"
            onClick={() => setMobileSearch((s) => !s)}
            className="md:hidden p-2 rounded-full hover:bg-muted"
            aria-label="Toggle search"
          >
            {mobileSearch ? <X className="w-5 h-5" /> : <SearchIcon className="w-5 h-5" />}
          </button>
          <Button asChild size="sm" variant="outline" className="inline-flex">
            <Link to={user ? "/post/new" : "/login"} search={user ? undefined : { redirect: "/post/new" }}>
              <PlusCircle className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Post</span>
            </Link>
          </Button>
          {user ? (
            <Link to="/me" className="flex items-center gap-2 shrink-0">
              <AvatarDisplay avatarKey={profile?.avatar_key ?? "boy-1"} size={36} online={profile?.show_online} />
              <span className="hidden sm:inline max-w-[120px] truncate text-sm font-semibold">
                {profile?.display_name ?? "Me"}
              </span>
            </Link>
          ) : (
            <Button asChild size="sm">
              <Link to="/login" search={{ redirect: router.state.location.href }}>
                <LogIn className="w-4 h-4 mr-1" /><span className="hidden xs:inline">Sign in</span>
              </Link>
            </Button>
          )}
        </div>
        {mobileSearch && (
          <div className="md:hidden border-t bg-background px-3 py-2">
            <SiteSearch autoFocus placeholder="Search posts, notes, courses…" />
          </div>
        )}
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 md:pb-6">{children}</main>
      <Link
        to={user ? "/post/new" : "/login"}
        search={user ? undefined : { redirect: "/post/new" }}
        aria-label="Create a post"
        className="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-glow flex items-center justify-center active:scale-95 transition"
      >
        <PlusCircle className="w-7 h-7" />
      </Link>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-1 grid grid-cols-7 text-[10px]">
          {[
            { to: "/", label: "Feed", icon: Home, key: "feed" },
            { to: "/blog", label: "Daily", icon: Newspaper, key: "blog" },
            { to: "/faculties", label: "Catalog", icon: Library, key: "cat" },
            { to: "/market", label: "Market", icon: ShoppingBag, key: "mkt" },
            { to: "/chat", label: "Chat", icon: MessageCircle, key: "chat" },
            { to: "/tools", label: "Tools", icon: ScanLine, key: "tools" },
            { to: user ? "/me" : "/login", label: user ? "Me" : "Sign in", icon: user ? User : LogIn, key: "me" },
          ].map(({ to, label, icon: Icon, key }) => (
            <Link key={key} to={to} className="flex flex-col items-center gap-0.5 py-2 hover:text-primary transition-colors relative">
              <Icon className="w-5 h-5" />
              {key === "chat" && unread > 0 && <UnreadDot count={unread} mobile />}
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function UnreadDot({ count, mobile }: { count: number; mobile?: boolean }) {
  return (
    <span
      aria-label={`${count} unread`}
      className={`absolute ${mobile ? "top-1 right-[28%]" : "-top-0.5 -right-0.5"} min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center shadow-card animate-pulse`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
