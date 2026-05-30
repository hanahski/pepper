import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { HeroCarousel } from "@/components/HeroCarousel";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { BookOpen, Sparkles, TrendingUp, Users, ScanLine, FileText, ShoppingBag, GraduationCap, Newspaper, Gamepad2, MessageCircle, Lock, ArrowUp } from "lucide-react";
import { SiteSearch } from "@/components/SiteSearch";

const TYPES = [
  { value: "all", label: "All" },
  { value: "past_question", label: "Past Q" },
  { value: "note", label: "Notes" },
  { value: "assignment", label: "Assignments" },
  { value: "novel", label: "Novels" },
  { value: "news", label: "News" },
  { value: "general", label: "General" },
] as const;

import csscover from "@/assets/course-csc.jpg";
import phycover from "@/assets/course-phy.jpg";
import educover from "@/assets/course-edu.jpg";
import amscover from "@/assets/course-ams.jpg";
import piocover from "@/assets/course-pio.jpg";
import lawcover from "@/assets/course-law.jpg";
import mthcover from "@/assets/course-mth.jpg";
import engcover from "@/assets/course-eng.jpg";
import { builtInPastQuestions, pastQuestionCover } from "@/lib/past-questions";

// Realistic photo per course-code prefix
function coverFor(code: string | null | undefined): string {
  const c = (code ?? "").toUpperCase();
  if (c.startsWith("CSC") || c.startsWith("COS")) return csscover;
  if (c.startsWith("PHY") || c.startsWith("AST")) return phycover;
  if (c.startsWith("EDU")) return educover;
  if (c.startsWith("AMS") || c.startsWith("ACC") || c.startsWith("BUS") || c.startsWith("MGT")) return amscover;
  if (c.startsWith("PIO") || c.startsWith("BIO") || c.startsWith("BCH") || c.startsWith("ANA") || c.startsWith("MED")) return piocover;
  if (c.startsWith("LAW")) return lawcover;
  if (c.startsWith("MTH") || c.startsWith("STA")) return mthcover;
  if (c.startsWith("ENG") || c.startsWith("LIT") || c.startsWith("GST")) return engcover;
  return educover;
}

const QUICK_TILES = [
  { to: "/faculties", label: "Faculties", icon: GraduationCap, tone: "from-sky-500 to-indigo-600" },
  { to: "/market", label: "Market Plug", icon: ShoppingBag, tone: "from-emerald-500 to-teal-600" },
  { to: "/tools/qr", label: "Scan Ticket", icon: ScanLine, tone: "from-fuchsia-500 to-rose-500" },
  { to: "/tools/ocr", label: "Scan Notes", icon: FileText, tone: "from-amber-500 to-orange-500" },
  { to: "/blog", label: "Daily News", icon: Newspaper, tone: "from-violet-500 to-purple-600" },
  { to: "/games", label: "Games", icon: Gamepad2, tone: "from-pink-500 to-rose-600" },
  { to: "/chat", label: "Chat", icon: MessageCircle, tone: "from-cyan-500 to-blue-600" },
  { to: "/notes", label: "Study Notes", icon: BookOpen, tone: "from-lime-500 to-emerald-600" },
] as const;

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user } = useAuth();
  const [type, setType] = useState<string>("all");
  const [pendingNew, setPendingNew] = useState(0);
  const qc = useQueryClient();
  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: async (): Promise<FeedPost[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id,title,body,post_type,file_url,image_url,media_url,media_type,link_url,view_count,like_count,comment_count,repost_count,created_at, course:courses(code,title), author:profiles!posts_author_id_fkey(id,display_name,avatar_key,rank_tier,rank_step,show_online,last_seen_at)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  // Realtime: surface new + deleted posts without page refresh.
  useEffect(() => {
    const channel = supabase
      .channel("feed-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        setPendingNew((n) => n + 1);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload: any) => {
        const id = payload.old?.id;
        if (!id) return;
        qc.setQueryData<FeedPost[]>(["feed"], (prev) => (prev ?? []).filter((p) => p.id !== id));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, (payload: any) => {
        const n = payload.new;
        if (!n?.id) return;
        qc.setQueryData<FeedPost[]>(["feed"], (prev) =>
          (prev ?? []).map((p) => p.id === n.id ? {
            ...p,
            like_count: n.like_count ?? p.like_count,
            comment_count: n.comment_count ?? p.comment_count,
            repost_count: n.repost_count ?? p.repost_count,
            view_count: n.view_count ?? p.view_count,
          } : p),
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const loadNew = () => {
    setPendingNew(0);
    qc.invalidateQueries({ queryKey: ["feed"] });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };


  const filtered = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => type === "all" || p.post_type === type);
  }, [posts, type]);

  const { data: activeUsers } = useQuery({
    queryKey: ["active-users"],
    queryFn: async () => {
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_key,rank_tier,rank_step")
        .gte("last_seen_at", since)
        .eq("show_online", true)
        .limit(8);
      return data ?? [];
    },
  });

  const { data: dbSampleNotes } = useQuery({
    queryKey: ["sample-notes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_notes")
        .select("id,title,body,course_id")
        .order("created_at", { ascending: false })
        .limit(6);
      if (!data?.length) return [];
      const ids = Array.from(new Set(data.map((n) => n.course_id).filter(Boolean) as string[]));
      const { data: courses } = ids.length
        ? await supabase.from("courses").select("id,code,title").in("id", ids)
        : { data: [] as Array<{ id: string; code: string; title: string }> };
      const cmap = new Map((courses ?? []).map((c) => [c.id, c]));
      return data.map((n) => ({ ...n, course: n.course_id ? cmap.get(n.course_id) ?? null : null }));
    },
  });

  const sampleNotes = useMemo(() => {
    const builtIns = builtInPastQuestions.slice(0, 12).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      course_id: null,
      course: n.course,
    }));
    return [...builtIns, ...(dbSampleNotes ?? [])];
  }, [dbSampleNotes]);

  const { data: blogs } = useQuery({
    queryKey: ["blogs-home"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blogs")
        .select("id,slug,title,excerpt,topic,hero_emoji,hero_image_url,created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: novels } = useQuery({
    queryKey: ["novels-home"],
    queryFn: async () => {
      const { data } = await supabase
        .from("market_listings")
        .select("id,title,price,photos,cover_url")
        .eq("listing_kind", "books")
        .eq("is_sold", false)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const [heroBlog, ...restBlogs] = blogs ?? [];

  return (
    <AppShell>
      <HeroCarousel />

      {/* Quick-tiles strip — Instagram-stories style */}
      <section className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-3 min-w-max pb-2">
          {QUICK_TILES.map((t) => (
            <Link key={t.to} to={t.to} className="flex flex-col items-center gap-1.5 group">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${t.tone} flex items-center justify-center shadow-card group-hover:scale-105 transition-transform`}>
                <t.icon className="w-7 h-7 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground/80">{t.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* AI Daily — magazine-style with a hero */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3" /> The Plug Daily · AI-curated
            </div>
            <h2 className="text-xl font-bold font-display mt-1">What students are reading today</h2>
          </div>
          <Link to="/blog" className="text-xs font-semibold text-primary hover:underline whitespace-nowrap">See all →</Link>
        </div>

        {heroBlog ? (
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
            <Link to="/blog/$slug" params={{ slug: heroBlog.slug }} className="group relative aspect-[16/10] lg:aspect-auto rounded-2xl overflow-hidden border bg-muted">
              {heroBlog.hero_image_url ? (
                <img src={heroBlog.hero_image_url} alt={heroBlog.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent flex items-center justify-center text-7xl">{heroBlog.hero_emoji ?? "📰"}</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">{heroBlog.topic}</span>
                <h3 className="font-display font-bold text-xl md:text-2xl leading-tight mt-2 line-clamp-2">{heroBlog.title}</h3>
                <p className="text-sm opacity-90 mt-1 line-clamp-2">{heroBlog.excerpt}</p>
              </div>
            </Link>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              {restBlogs.slice(0, 4).map((b) => (
                <Link key={b.id} to="/blog/$slug" params={{ slug: b.slug }} className="group flex gap-3 bg-card border rounded-xl overflow-hidden hover-lift">
                  {b.hero_image_url ? (
                    <img src={b.hero_image_url} alt={b.title} loading="lazy" className="w-20 h-20 lg:w-24 lg:h-24 object-cover shrink-0" />
                  ) : (
                    <div className="w-20 h-20 lg:w-24 lg:h-24 shrink-0 bg-gradient-to-br from-primary/30 to-accent flex items-center justify-center text-2xl">{b.hero_emoji ?? "📰"}</div>
                  )}
                  <div className="p-2 pr-3 min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary truncate">{b.topic}</p>
                    <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary mt-0.5">{b.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-accent to-background p-5 text-sm text-muted-foreground">
            First AI brief is being written — check back in a few minutes.
          </div>
        )}
      </section>

      {/* Novels strip */}
      {!!novels?.length && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold font-display flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" />Fresh novels in the Market</h2>
            <Link to="/market" className="text-xs font-semibold text-primary hover:underline">Browse all →</Link>
          </div>
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
            <div className="flex gap-3 min-w-max pb-2">
              {novels.map((n: any) => {
                const img = n.cover_url ?? n.photos?.[0];
                return (
                  <Link key={n.id} to="/market/$id" params={{ id: n.id }} className="w-36 shrink-0 group">
                    <div className="aspect-[2/3] rounded-xl overflow-hidden border bg-muted">
                      {img ? (
                        <img src={img} alt={n.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent flex items-center justify-center text-4xl">📚</div>
                      )}
                    </div>
                    <p className="text-xs font-semibold mt-2 line-clamp-2 group-hover:text-primary">{n.title}</p>
                    <p className="text-xs text-primary font-bold">₦{Number(n.price).toLocaleString()}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-[1fr_280px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold font-display flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Latest posts</h2>
            <Link to="/faculties" className="text-sm text-primary hover:underline">Browse by course →</Link>
          </div>
          <div className="mb-4 space-y-2">
            <SiteSearch />
            <div className="flex gap-2 flex-wrap">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition ${type === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {pendingNew > 0 && (
            <button
              onClick={loadNew}
              className="w-full mb-3 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-glow hover:opacity-90 animate-fade-in-up"
            >
              <ArrowUp className="w-4 h-4" /> {pendingNew} new post{pendingNew === 1 ? "" : "s"} — tap to load
            </button>
          )}
          {isLoading ? (
            <p className="text-muted-foreground">Loading feed…</p>
          ) : (
            <div className="space-y-6">
              {!!filtered.length && (
                <div className="space-y-4">
                  {filtered.map((p) => <PostCard key={p.id} post={p} locked={!user} />)}
                </div>
              )}
              {!!sampleNotes?.length && (type === "all" || type === "past_question") && (
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">
                    EBSU past questions {user ? "— tap to read" : "— preview (sign in to unlock)"}
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {sampleNotes.map((n) => {
                      const Inner = (
                        <>
                          <div className="h-32 relative">
                            <img
                              src={n.id.startsWith("pdf-page-") ? pastQuestionCover : coverFor(n.course?.code)}
                              alt={n.course?.code ?? "Past question"}
                              className={`w-full h-full object-cover ${!user ? "blur-[2px] scale-105" : ""}`}
                              loading="lazy"
                              width={1024}
                              height={640}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                            {n.course?.code && (
                              <span className="absolute bottom-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-foreground">
                                {n.course.code}
                              </span>
                            )}
                            {!user && (
                              <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-black/70 text-white">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            )}
                          </div>
                          <div className="p-4">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">PAST QUESTION</span>
                            <p className="font-bold font-display text-sm mt-2 line-clamp-2">{n.title}</p>
                            <p className={`text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap ${!user ? "blur-[3px] select-none" : ""}`}>{n.body}</p>
                            {user ? (
                              <p className="text-[10px] text-primary mt-2 font-semibold">Click to view full question →</p>
                            ) : (
                              <Link
                                to="/login"
                                search={{ redirect: "/" }}
                                className="mt-3 inline-flex items-center justify-center gap-1 w-full text-xs font-bold px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90"
                              >
                                <Lock className="w-3 h-3" /> Sign in to unlock
                              </Link>
                            )}
                          </div>
                        </>
                      );
                      return user ? (
                        <Link
                          key={n.id}
                          to="/notes/$id"
                          params={{ id: n.id }}
                          className="bg-card border rounded-2xl overflow-hidden shadow-card hover-lift block"
                        >
                          {Inner}
                        </Link>
                      ) : (
                        <div
                          key={n.id}
                          className="bg-card border rounded-2xl overflow-hidden shadow-card block"
                        >
                          {Inner}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!filtered.length && !sampleNotes?.length && (
                <div className="bg-card border rounded-2xl p-6 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold">Nothing here yet — be the first plug.</p>
                  <Button asChild className="mt-4">
                    <Link to={user ? "/post/new" : "/login"}>Create a post</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <aside className="space-y-4">
          <div className="bg-card border rounded-2xl p-4">
            <h3 className="font-bold flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-success" />Active now</h3>
            {activeUsers?.length ? (
              <ul className="space-y-2 text-sm">
                {activeUsers.map((u) => (
                  <li key={u.id}><Link to="/profile/$id" params={{ id: u.id }} className="flex items-center gap-2 hover:text-primary">
                    <span className="w-2 h-2 rounded-full bg-success online-dot" /> {u.display_name}
                  </Link></li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">No one online right now.</p>}
          </div>
          <div className="bg-gradient-to-br from-primary/10 to-accent rounded-2xl p-4 border">
            <h3 className="font-bold">Rank up</h3>
            <p className="text-xs text-muted-foreground mt-1">Post 10 contents to climb each step. 5 steps per tier. Top rank: <strong>Sure Plug 👑</strong>.</p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
