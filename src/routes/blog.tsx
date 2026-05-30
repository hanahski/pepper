import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/blog")({ component: BlogIndex });

function BlogIndex() {
  const { data: blogs, isLoading } = useQuery({
    queryKey: ["blogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blogs")
        .select("id,slug,title,excerpt,topic,hero_emoji,hero_image_url,created_at,view_count")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full mb-2">
          <Sparkles className="w-3.5 h-3.5" /> AI-curated · updated 5×/day
        </div>
        <h1 className="text-3xl font-bold font-display">The Plug Daily</h1>
        <p className="text-muted-foreground">Trending takes on government, university life and student finance — written fresh for you.</p>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !blogs?.length ? (
        <p className="text-muted-foreground">No articles yet. The AI is warming up — first post drops shortly.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {blogs.map((b) => (
            <Link key={b.id} to="/blog/$slug" params={{ slug: b.slug }} className="group bg-card border rounded-2xl overflow-hidden hover:shadow-card transition flex flex-col">
              {b.hero_image_url ? (
                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                  <img src={b.hero_image_url} alt={b.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-2 left-2 text-2xl drop-shadow-lg">{b.hero_emoji ?? "📰"}</div>
                </div>
              ) : (
                <div className="aspect-[16/9] bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center text-6xl">{b.hero_emoji ?? "📰"}</div>
              )}
              <div className="p-4 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary">{b.topic}</div>
                <h2 className="font-display font-bold text-lg mt-1 group-hover:text-primary line-clamp-2">{b.title}</h2>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{b.excerpt}</p>
                <p className="text-xs text-muted-foreground mt-3">{new Date(b.created_at).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
