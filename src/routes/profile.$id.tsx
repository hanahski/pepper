import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import { RankBadge } from "@/components/RankBadge";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { encouragement, nextLevelLabel, rankProgress } from "@/lib/ranks";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BadgeCheck, GraduationCap, MessageSquare, Send } from "lucide-react";
import { getOrCreateDmThread } from "@/lib/dm";
import { toast } from "sonner";

export const Route = createFileRoute("/profile/$id")({ component: ProfilePage });

function ProfilePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState("posts");
  const navigate = useNavigate();
  const [dmBusy, setDmBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      const [{ data: posts }, dept] = await Promise.all([
        supabase.from("posts")
          .select("id,title,body,post_type,file_url,view_count,like_count,comment_count,repost_count,created_at, course:courses(code,title), author:profiles!posts_author_id_fkey(id,display_name,avatar_key,rank_tier,rank_step,show_online,last_seen_at)")
          .eq("author_id", id).order("created_at", { ascending: false }),
        p?.department_id
          ? supabase.from("departments").select("name,faculty:faculties(name)").eq("id", p.department_id).maybeSingle().then((r) => r.data)
          : Promise.resolve(null),
      ]);
      return { profile: p, posts: (posts ?? []) as unknown as FeedPost[], dept };
    },
  });

  if (!data?.profile) return <AppShell><p>Loading…</p></AppShell>;
  const p: any = data.profile;
  const prog = rankProgress(p.approved_post_count);
  const online = p.show_online && Date.now() - new Date(p.last_seen_at).getTime() < 5 * 60_000;
  const coverUrl = p.cover_url as string | null;
  const isMe = user?.id === p.id;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="bg-card border rounded-3xl shadow-card overflow-hidden">
          <div
            className="h-32 sm:h-44 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 bg-cover bg-center"
            style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          />
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-4 flex-wrap -mt-12 sm:-mt-16">
              <div className="rounded-full ring-4 ring-card">
                <AvatarDisplay avatarKey={p.avatar_key} size={88} online={online} />
              </div>
              <div className="flex-1 min-w-0 pt-2 w-full">
                <h1 className="text-xl sm:text-2xl font-bold font-display leading-tight break-words flex items-start gap-2">
                  <span className="break-words min-w-0 flex-1">{p.display_name}</span>
                  {p.is_verified && <BadgeCheck className="w-5 h-5 text-primary shrink-0 mt-1" />}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <RankBadge tier={p.rank_tier} step={p.rank_step} />
                  <span className="text-xs text-muted-foreground">{p.approved_post_count} posts</span>
                  {p.academic_level && <Badge variant="secondary">{p.academic_level} level</Badge>}
                </div>
                {!isMe && (
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={dmBusy}
                    onClick={async () => {
                      if (!user) { navigate({ to: "/login", search: { redirect: `/profile/${p.id}` } }); return; }
                      setDmBusy(true);
                      try {
                        const tid = await getOrCreateDmThread(user.id, p.id);
                        navigate({ to: "/chat", search: { t: tid } as any });
                      } catch (e: any) {
                        toast.error(e.message ?? "Couldn't open chat");
                      } finally {
                        setDmBusy(false);
                      }
                    }}
                  >
                    <Send className="w-4 h-4 mr-1.5" /> Message
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold">Progress to {nextLevelLabel(prog.tier, prog.step)}</span>
                <span className="text-muted-foreground">{prog.postsInStep}/10 posts</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-hero rank-grow" style={{ width: `${prog.pct}%` }} />
              </div>
              <p className="text-xs text-primary mt-2 italic">{encouragement(p.approved_post_count)}</p>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="posts">Posts ({data.posts.length})</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            <div className="space-y-3">
              {data.posts.map((post) => <PostCard key={post.id} post={post} />)}
              {!data.posts.length && <p className="text-sm text-muted-foreground">{isMe ? "You haven't" : "This user hasn't"} posted yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="about" className="mt-4 space-y-3">
            <div className="bg-card border rounded-2xl p-5 space-y-3">
              {p.bio ? (
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">Bio</h3>
                  <p className="text-sm whitespace-pre-wrap">{p.bio}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No bio yet.</p>
              )}
              {data.dept?.name && (
                <div className="flex items-start gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>
                    <b>{data.dept.name}</b>
                    {(data.dept as any).faculty?.name && <span className="text-muted-foreground"> • {(data.dept as any).faculty.name}</span>}
                  </span>
                </div>
              )}
              {p.academic_level && (
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                  <span>{p.academic_level} level student</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Joined {new Date(p.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
