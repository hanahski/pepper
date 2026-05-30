import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, Heart, FileText, Lock, MessageCircle, Repeat2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AvatarDisplay } from "./AvatarDisplay";
import { RankBadge } from "./RankBadge";
import { Comments } from "./Comments";
import { EbsuBadge } from "./EbsuBadge";
import { MediaPlayer } from "./MediaPlayer";
import { isOnline } from "@/lib/presence";
import type { RankTier } from "@/lib/ranks";
import { formatDistanceToNow } from "date-fns";

export type FeedPost = {
  id: string;
  title: string;
  body: string | null;
  post_type: string;
  file_url: string | null;
  image_url?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  link_url?: string | null;
  view_count: number;
  like_count: number;
  comment_count?: number;
  repost_count?: number;
  created_at: string;
  course?: { code: string; title: string } | null;
  author: {
    id: string;
    display_name: string;
    avatar_key: string;
    rank_tier: RankTier;
    rank_step: number;
    show_online: boolean;
    last_seen_at: string;
  } | null;
};

export function PostCard({ post, locked }: { post: FeedPost; locked?: boolean }) {
  const online = isOnline(post.author?.show_online, post.author?.last_seen_at);
  const { user } = useAuth();
  const nav = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [reposted, setReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(post.repost_count ?? 0);
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!user) { setLiked(false); setReposted(false); return; }
    supabase.from("post_likes").select("post_id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setLiked(!!data));
    supabase.from("post_reposts").select("post_id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setReposted(!!data));
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user, post.id]);

  // Realtime: live like + comment counts for this post.
  useEffect(() => {
    const channel = supabase
      .channel(`post-${post.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_likes", filter: `post_id=eq.${post.id}` },
        (payload: any) => {
          setLikeCount((c) => c + 1);
          if (user && payload.new?.user_id === user.id) setLiked(true);
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "post_likes", filter: `post_id=eq.${post.id}` },
        (payload: any) => {
          setLikeCount((c) => Math.max(0, c - 1));
          if (user && payload.old?.user_id === user.id) setLiked(false);
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_comments", filter: `post_id=eq.${post.id}` },
        () => setCommentCount((c) => c + 1))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "post_comments", filter: `post_id=eq.${post.id}` },
        () => setCommentCount((c) => Math.max(0, c - 1)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [post.id, user?.id]);

  const requireAuth = (msg: string) => {
    toast.error(msg);
    nav({ to: "/login", search: { redirect: "/" } });
  };

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) return requireAuth("Sign in to like posts");
    if (liked) {
      setLiked(false);
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      setLiked(true);
      const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      if (error) setLiked(false);
    }
  };

  const toggleRepost = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) return requireAuth("Sign in to repost");
    if (reposted) {
      await supabase.from("post_reposts").delete().eq("post_id", post.id).eq("user_id", user.id);
      setReposted(false); setRepostCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase.from("post_reposts").insert({ post_id: post.id, user_id: user.id });
      if (!error) { setReposted(true); setRepostCount((c) => c + 1); toast.success("Reposted"); }
    }
  };

  const onToggleComments = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setShowComments((s) => !s);
  };



  const canDelete = user && (user.id === post.author?.id || isAdmin);
  const onDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); setRemoved(true); }
  };

  if (removed) return null;

  // General + news posts get a larger, magazine-style layout
  const isFeatured = post.post_type === "general" || post.post_type === "news";

  return (
    <article className={`relative bg-card rounded-2xl shadow-card border hover:shadow-glow transition-shadow ${isFeatured ? "p-5 md:p-6" : "p-4"}`}>
      {/* EBSU badge — top-left corner on every post */}
      <div className="absolute -top-2 left-3 z-10">
        <EbsuBadge size={22} />
      </div>
      <header className="flex items-center gap-3 mb-3 mt-2">
        <Link to="/profile/$id" params={{ id: post.author?.id ?? "" }}>
          <AvatarDisplay avatarKey={post.author?.avatar_key ?? "boy-1"} online={online} size={40} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/profile/$id" params={{ id: post.author?.id ?? "" }} className="font-semibold truncate hover:underline">
              {post.author?.display_name ?? "Unknown"}
            </Link>
            {post.author && <RankBadge tier={post.author.rank_tier} step={post.author.rank_step} size="sm" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            {post.course && <> · <span className="text-primary font-medium">{post.course.code}</span></>}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-accent text-accent-foreground font-bold">
          {post.post_type.replace("_", " ")}
        </span>
      </header>
      <Link to="/post/$id" params={{ id: post.id }}>
        <h3 className={`font-display font-bold leading-tight mb-1 hover:text-primary ${isFeatured ? "text-2xl md:text-3xl" : "text-lg"}`}>{post.title}</h3>
        {post.image_url && (
          <img
            src={post.image_url}
            alt={post.title}
            loading="lazy"
            className={`mt-2 mb-2 w-full object-cover rounded-xl border ${isFeatured ? "aspect-[16/9] md:aspect-[2/1]" : "aspect-[16/10]"}`}
          />
        )}
        {post.body && (
          <p className={`text-muted-foreground whitespace-pre-wrap ${isFeatured ? "text-base line-clamp-6" : "text-sm line-clamp-3"} ${locked ? "blur-[3px] select-none" : ""}`}>
            {post.body.slice(0, isFeatured ? 600 : 280)}
          </p>
        )}
      </Link>
      {(post.media_url || post.link_url) && !locked && (
        <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          {post.media_url && (
            <MediaPlayer url={post.media_url} type={post.media_type} title={post.title} />
          )}
          {post.link_url && (
            <MediaPlayer url={post.link_url} type="video" title={post.title} />
          )}
        </div>
      )}
      {locked && (
        <div className="mt-3 flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-2 rounded-lg">
          <Lock className="w-3.5 h-3.5" />
          <span>Sign in to read the full post, like, comment and repost.</span>
        </div>
      )}
      {post.file_url && !locked && (
        <div className="mt-3 inline-flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
          <FileText className="w-3.5 h-3.5" /> File attached
        </div>
      )}
      <footer className="mt-3 flex items-center gap-1 text-xs flex-wrap">
        <button
          onClick={toggleLike}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full transition ${liked ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`} /> {likeCount}
        </button>
        <button
          onClick={onToggleComments}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full transition ${showComments ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          <MessageCircle className="w-3.5 h-3.5" /> {commentCount}
        </button>
        <button
          onClick={toggleRepost}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full transition ${reposted ? "bg-success/15 text-success" : "text-muted-foreground hover:bg-muted"}`}
        >
          <Repeat2 className="w-3.5 h-3.5" /> {repostCount}
        </button>
        <span className="inline-flex items-center gap-1 px-2 py-1 text-muted-foreground">
          <Eye className="w-3.5 h-3.5" /> {post.view_count}
        </span>
        {!locked && (
          <SaveButton
            itemType="post"
            itemId={post.id}
            title={post.title}
            subtitle={post.author?.display_name ?? null}
            thumbUrl={post.image_url ?? null}
            variant="pill"
          />
        )}
        {canDelete && (
          <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </footer>

      {showComments && !locked && (
        <div className="mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
          <Comments postId={post.id} />
        </div>
      )}
      {showComments && locked && (
        <div className="mt-3 pt-3 border-t">
          <Link to="/login" search={{ redirect: "/" }} className="block text-xs text-primary font-semibold hover:underline">Sign in to view and post comments →</Link>
        </div>
      )}
    </article>
  );
}
