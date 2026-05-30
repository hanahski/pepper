import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogDetail,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AppShell>
        <p className="text-destructive">Failed to load: {error.message}</p>
        <button onClick={() => { reset(); router.invalidate(); }} className="mt-3 text-primary underline">Retry</button>
      </AppShell>
    );
  },
  notFoundComponent: () => (
    <AppShell>
      <p>Article not found.</p>
      <Link to="/blog" className="text-primary underline">Back to blog</Link>
    </AppShell>
  ),
});

function BlogDetail() {
  const { slug } = Route.useParams();
  const { data: blog, isLoading } = useQuery({
    queryKey: ["blog", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("blogs").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"><ArrowLeft className="w-4 h-4" />All articles</Link>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !blog ? (
        <p>Not found.</p>
      ) : (
        <article className="max-w-3xl mx-auto">
          {blog.hero_image_url && (
            <div className="rounded-2xl overflow-hidden mb-6 aspect-[16/9] bg-muted shadow-card">
              <img src={blog.hero_image_url} alt={blog.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="text-4xl mb-2">{blog.hero_emoji}</div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{blog.topic}</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-1 mb-2">{blog.title}</h1>
          <p className="text-muted-foreground text-sm">{new Date(blog.created_at).toLocaleString()} · AI-curated</p>
          <p className="text-lg text-muted-foreground mt-4">{blog.excerpt}</p>
          <div className="mt-6 whitespace-pre-wrap leading-relaxed text-base">{blog.body}</div>
        </article>
      )}
    </AppShell>
  );
}
