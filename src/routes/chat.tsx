import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import {
  ArrowLeft,
  Check,
  Globe,
  MapPin,
  MessageCircle,
  Navigation,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { getOrCreateDmThread } from "@/lib/dm";

type ChatSearch = { t?: string; tab?: "dms" | "campus" | "nearby" };

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  validateSearch: (s: Record<string, unknown>): ChatSearch => ({
    t: typeof s.t === "string" ? s.t : undefined,
    tab: s.tab === "campus" || s.tab === "nearby" || s.tab === "dms" ? s.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chat Plug — StudentsPlug" },
      { name: "description", content: "Private DMs, group chats and campus chat for EBSU students." },
    ],
  }),
});

type ProfileLite = { id: string; display_name: string; avatar_key: string; show_online: boolean; last_seen_at: string };

type ThreadRow = {
  id: string;
  user_a: string | null;
  user_b: string | null;
  last_message_at: string;
  is_group: boolean;
  name: string | null;
  photo_url: string | null;
  owner_id: string | null;
  other?: ProfileLite | null;
  memberCount?: number;
  last?: { body: string; sender_id: string; created_at: string } | null;
};

function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const activeTab = search.tab ?? (search.t ? "dms" : "dms");
  const activeThread = search.t ?? null;

  if (!user) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-16">
          <MessageCircle className="w-12 h-12 mx-auto text-primary mb-3" />
          <h1 className="text-2xl font-display font-bold">Chat Plug</h1>
          <p className="text-sm text-muted-foreground mt-2">Sign in to send and receive private messages.</p>
          <Button asChild className="mt-4">
            <Link to="/login" search={{ redirect: "/chat" }}>Sign in to chat</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold">Chat Plug</h1>
            <p className="text-xs text-muted-foreground">DMs · Groups · Campus · Nearby</p>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <TabButton active={activeTab === "dms"} onClick={() => navigate({ to: "/chat", search: { tab: "dms" } })}>
              <MessageCircle className="w-3.5 h-3.5" /> Chats
            </TabButton>
            <TabButton active={activeTab === "campus"} onClick={() => navigate({ to: "/chat", search: { tab: "campus" } })}>
              <Globe className="w-3.5 h-3.5" /> Campus
            </TabButton>
            <TabButton active={activeTab === "nearby"} onClick={() => navigate({ to: "/chat", search: { tab: "nearby" } })}>
              <MapPin className="w-3.5 h-3.5" /> Nearby
            </TabButton>
          </div>
        </div>

        {activeTab === "dms" && <DmsView meId={user.id} activeThread={activeThread} />}
        {activeTab === "campus" && <RoomView meId={user.id} scope="global" />}
        {activeTab === "nearby" && <RoomView meId={user.id} scope="nearby" />}
      </div>
    </AppShell>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1 transition ${
        active ? "bg-background shadow-sm" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------- DMs + Groups: thread list + open thread ---------------- */

function DmsView({ meId, activeThread }: { meId: string; activeThread: string | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: threads = [] } = useQuery<ThreadRow[]>({
    queryKey: ["dm-threads", meId],
    queryFn: async () => {
      // 1:1 threads I'm in
      const { data: oneRows, error: oneErr } = await supabase
        .from("dm_threads")
        .select("id,user_a,user_b,last_message_at,is_group,name,photo_url,owner_id")
        .or(`user_a.eq.${meId},user_b.eq.${meId}`)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (oneErr) throw oneErr;

      // Group threads I'm a member of
      const { data: myMemberRows } = await supabase
        .from("dm_thread_members")
        .select("thread_id")
        .eq("user_id", meId);
      const memberThreadIds = (myMemberRows ?? []).map((r) => r.thread_id);
      let groupRows: any[] = [];
      if (memberThreadIds.length) {
        const { data: gr } = await supabase
          .from("dm_threads")
          .select("id,user_a,user_b,last_message_at,is_group,name,photo_url,owner_id")
          .in("id", memberThreadIds)
          .eq("is_group", true)
          .order("last_message_at", { ascending: false });
        groupRows = gr ?? [];
      }

      const rows = [...(oneRows ?? []), ...groupRows] as ThreadRow[];
      // De-dup
      const seen = new Set<string>();
      const merged = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
      merged.sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));

      const otherIds = Array.from(
        new Set(
          merged
            .filter((r) => !r.is_group)
            .map((r) => (r.user_a === meId ? r.user_b : r.user_a))
            .filter((x): x is string => !!x),
        ),
      );
      const tIds = merged.map((r) => r.id);
      const groupIds = merged.filter((r) => r.is_group).map((r) => r.id);

      const [profilesRes, lastsRes, memCountRes] = await Promise.all([
        otherIds.length
          ? supabase.from("profiles").select("id,display_name,avatar_key,show_online,last_seen_at").in("id", otherIds)
          : Promise.resolve({ data: [] as any[] }),
        tIds.length
          ? supabase
              .from("dm_messages")
              .select("thread_id,body,sender_id,created_at")
              .in("thread_id", tIds)
              .order("created_at", { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [] as any[] }),
        groupIds.length
          ? supabase.from("dm_thread_members").select("thread_id").in("thread_id", groupIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      const lastMap = new Map<string, any>();
      for (const m of lastsRes.data ?? []) if (!lastMap.has(m.thread_id)) lastMap.set(m.thread_id, m);
      const countMap = new Map<string, number>();
      for (const m of memCountRes.data ?? []) countMap.set(m.thread_id, (countMap.get(m.thread_id) ?? 0) + 1);

      return merged.map((r) => {
        const otherId = !r.is_group ? (r.user_a === meId ? r.user_b : r.user_a) : null;
        return {
          ...r,
          other: otherId ? (pMap.get(otherId) ?? null) : null,
          last: lastMap.get(r.id) ?? null,
          memberCount: r.is_group ? (countMap.get(r.id) ?? 0) : undefined,
        };
      });
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`dm-threads-${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_threads" }, () =>
        qc.invalidateQueries({ queryKey: ["dm-threads", meId] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () =>
        qc.invalidateQueries({ queryKey: ["dm-threads", meId] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_thread_members" }, () =>
        qc.invalidateQueries({ queryKey: ["dm-threads", meId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [meId, qc]);

  const open = (id: string) => navigate({ to: "/chat", search: { tab: "dms", t: id } });
  const back = () => navigate({ to: "/chat", search: { tab: "dms" } });

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-3 h-[calc(100vh-12rem)]">
      <aside className={`${activeThread ? "hidden md:block" : "block"} bg-card border rounded-2xl overflow-hidden md:flex md:flex-col relative`}>
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sm">Conversations</h2>
          <NewChatButton meId={meId} onCreated={open} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center px-4 py-8">
              No conversations yet. Tap <b>New</b> to start a chat or create a group.
            </p>
          ) : (
            threads.map((t) => {
              const isActive = t.id === activeThread;
              const preview = t.last?.body ?? "Say hi 👋";
              const mine = t.last?.sender_id === meId;
              const title = t.is_group
                ? (t.name ?? "Group")
                : (t.other?.display_name ?? "Student");
              return (
                <button
                  key={t.id}
                  onClick={() => open(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition ${
                    isActive ? "bg-muted" : ""
                  } border-b last:border-b-0`}
                >
                  {t.is_group ? (
                    <div className="w-[42px] h-[42px] rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  ) : (
                    <AvatarDisplay
                      avatarKey={t.other?.avatar_key ?? "boy-1"}
                      size={42}
                      online={!!(t.other?.show_online && t.other?.last_seen_at && Date.now() - new Date(t.other.last_seen_at).getTime() < 3 * 60_000)}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{title}</span>
                      {t.last && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(t.last.created_at), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.is_group && <span className="opacity-70">{t.memberCount ?? 0} members · </span>}
                      {mine && "You: "}
                      {preview}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className={`${activeThread ? "block" : "hidden md:block"} bg-card border rounded-2xl overflow-hidden`}>
        {activeThread ? (
          <ThreadPane meId={meId} threadId={activeThread} onBack={back} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            Pick a conversation on the left, or start a new one.
          </div>
        )}
      </section>
    </div>
  );
}

function ThreadPane({ meId, threadId, onBack }: { meId: string; threadId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["dm", threadId],
    queryFn: async () => {
      const { data: thread } = await supabase
        .from("dm_threads")
        .select("id,user_a,user_b,is_group,name,photo_url,owner_id")
        .eq("id", threadId)
        .maybeSingle();
      if (!thread) return { thread: null, msgs: [], other: null, members: [], senders: new Map() };

      const isGroup = thread.is_group;
      const otherId = !isGroup ? (thread.user_a === meId ? thread.user_b : thread.user_a) : null;

      const [{ data: msgs }, otherRes, membersRes] = await Promise.all([
        supabase
          .from("dm_messages")
          .select("id,sender_id,body,created_at")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true })
          .limit(500),
        otherId
          ? supabase.from("profiles").select("id,display_name,avatar_key,show_online,last_seen_at").eq("id", otherId).maybeSingle()
          : Promise.resolve({ data: null }),
        isGroup
          ? supabase.from("dm_thread_members").select("user_id,role").eq("thread_id", threadId)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      let memberProfiles: ProfileLite[] = [];
      if (isGroup && (membersRes.data ?? []).length) {
        const ids = (membersRes.data ?? []).map((m: any) => m.user_id);
        const { data: prof } = await supabase
          .from("profiles")
          .select("id,display_name,avatar_key,show_online,last_seen_at")
          .in("id", ids);
        memberProfiles = (prof ?? []) as ProfileLite[];
      }

      const senderIds = Array.from(new Set((msgs ?? []).map((m: any) => m.sender_id)));
      let senderMap = new Map<string, ProfileLite>();
      if (isGroup && senderIds.length) {
        const have = new Map(memberProfiles.map((p) => [p.id, p]));
        const missing = senderIds.filter((id) => !have.has(id));
        if (missing.length) {
          const { data: extra } = await supabase
            .from("profiles")
            .select("id,display_name,avatar_key,show_online,last_seen_at")
            .in("id", missing);
          for (const p of extra ?? []) have.set(p.id, p as ProfileLite);
        }
        senderMap = have;
      }

      return { thread, msgs: msgs ?? [], other: otherRes.data as ProfileLite | null, members: memberProfiles, senders: senderMap };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`dm-thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_messages", filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ["dm", threadId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_thread_members", filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ["dm", threadId] }),
      )
      .subscribe();
    // Mark thread as read when opened, and again when new messages arrive while viewing
    void supabase
      .from("dm_thread_reads")
      .upsert({ user_id: meId, thread_id: threadId, last_read_at: new Date().toISOString() }, { onConflict: "user_id,thread_id" });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [threadId, qc, meId]);

  // Re-mark as read whenever the message list grows while we're on this thread
  useEffect(() => {
    if (!data?.msgs.length) return;
    void supabase
      .from("dm_thread_reads")
      .upsert({ user_id: meId, thread_id: threadId, last_read_at: new Date().toISOString() }, { onConflict: "user_id,thread_id" });
  }, [data?.msgs.length, meId, threadId]);


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.msgs.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    const { error } = await supabase.from("dm_messages").insert({ thread_id: threadId, sender_id: meId, body });
    if (error) {
      toast.error(error.message);
      setText(body);
      return;
    }
    await supabase.from("dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("dm_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["dm", threadId] });
  };

  const leaveGroup = async () => {
    if (!confirm("Leave this group?")) return;
    const { error } = await supabase.from("dm_thread_members").delete().eq("thread_id", threadId).eq("user_id", meId);
    if (error) return toast.error(error.message);
    toast.success("Left group");
    qc.invalidateQueries({ queryKey: ["dm-threads", meId] });
    onBack();
  };

  const thread = data?.thread;
  const isGroup = !!thread?.is_group;
  const other = data?.other ?? null;
  const online = !isGroup && other?.show_online && other?.last_seen_at && Date.now() - new Date(other.last_seen_at).getTime() < 3 * 60_000;
  const senders = data?.senders ?? new Map<string, ProfileLite>();

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-3 py-2 border-b">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {isGroup ? (
          <button
            onClick={() => setMembersOpen((v) => !v)}
            className="flex items-center gap-3 min-w-0 flex-1 text-left"
          >
            <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{thread?.name ?? "Group"}</div>
              <div className="text-[11px] text-muted-foreground">
                {data?.members.length ?? 0} members · tap for details
              </div>
            </div>
          </button>
        ) : (
          <>
            <AvatarDisplay avatarKey={other?.avatar_key ?? "boy-1"} size={36} online={!!online} />
            <Link to="/profile/$id" params={{ id: other?.id ?? "" }} className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate hover:underline">{other?.display_name ?? "Student"}</div>
              <div className="text-[11px] text-muted-foreground">{online ? "Online now" : "Tap to view profile"}</div>
            </Link>
          </>
        )}
      </header>

      {isGroup && membersOpen && (
        <div className="border-b bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Members</span>
            <button onClick={() => setMembersOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(data?.members ?? []).map((m) => (
              <Link
                key={m.id}
                to="/profile/$id"
                params={{ id: m.id }}
                className="flex items-center gap-1.5 bg-card border rounded-full pl-1 pr-3 py-1 text-xs hover:bg-muted"
              >
                <AvatarDisplay avatarKey={m.avatar_key} size={20} />
                <span className="truncate max-w-[100px]">{m.display_name}</span>
                {m.id === thread?.owner_id && <span className="text-[9px] text-primary font-bold">OWNER</span>}
              </Link>
            ))}
          </div>
          {thread?.owner_id === meId && <AddMembersButton threadId={threadId} existingIds={(data?.members ?? []).map((m) => m.id)} />}
          <Button size="sm" variant="destructive" onClick={leaveGroup} className="w-full">
            Leave group
          </Button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-muted/30 p-3 space-y-2">
        {(data?.msgs ?? []).length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet. Say hi 👋</p>
        )}
        {(data?.msgs ?? []).map((m: any) => {
          const mine = m.sender_id === meId;
          const sender = isGroup ? senders.get(m.sender_id) : null;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {isGroup && !mine && (
                <AvatarDisplay avatarKey={sender?.avatar_key ?? "boy-1"} size={28} className="mt-auto" />
              )}
              <div className="max-w-[78%] group">
                {isGroup && !mine && (
                  <div className="text-[10px] font-semibold text-primary mb-0.5 px-1">{sender?.display_name ?? "Student"}</div>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                    mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border rounded-bl-sm"
                  }`}
                >
                  {m.body}
                </div>
                <div className={`text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 ${mine ? "justify-end" : ""}`}>
                  <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                  {mine && (
                    <button onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100 hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t p-2 flex gap-2 bg-card"
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={2000} />
        <Button type="submit" disabled={!text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}

/* ---------------- New chat / new group popover ---------------- */

function NewChatButton({ meId, onCreated }: { meId: string; onCreated: (threadId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"dm" | "group">("dm");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [groupName, setGroupName] = useState("");
  const [picked, setPicked] = useState<ProfileLite[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  const reset = () => {
    setOpen(false);
    setQ("");
    setGroupName("");
    setPicked([]);
    setMode("dm");
  };

  const { data: results = [] } = useQuery<ProfileLite[]>({
    queryKey: ["dm-search", debounced],
    enabled: open && debounced.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_key,show_online,last_seen_at")
        .ilike("display_name", `%${debounced}%`)
        .neq("id", meId)
        .limit(20);
      return (data ?? []) as ProfileLite[];
    },
  });

  const startDm = async (otherId: string) => {
    try {
      const tid = await getOrCreateDmThread(meId, otherId);
      reset();
      onCreated(tid);
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't start chat");
    }
  };

  const togglePick = (p: ProfileLite) => {
    setPicked((prev) => (prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]));
  };

  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) return toast.error("Give the group a name");
    if (picked.length < 1) return toast.error("Add at least one member");
    setSaving(true);
    try {
      const { data: t, error } = await supabase
        .from("dm_threads")
        .insert({ is_group: true, name, owner_id: meId, last_message_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error) throw error;
      const rows = [{ thread_id: t.id, user_id: meId, role: "owner" }, ...picked.map((p) => ({ thread_id: t.id, user_id: p.id, role: "member" }))];
      const { error: mErr } = await supabase.from("dm_thread_members").insert(rows);
      if (mErr) throw mErr;
      toast.success("Group created");
      reset();
      onCreated(t.id);
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't create group");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="w-4 h-4 mr-1" /> New
      </Button>
    );
  }

  return (
    <div className="absolute z-30 top-12 left-3 right-3 bg-card border rounded-xl shadow-glow p-3 max-h-[70vh] overflow-hidden flex flex-col">
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-2">
        <button
          onClick={() => setMode("dm")}
          className={`flex-1 px-2 py-1.5 rounded-md text-xs flex items-center justify-center gap-1 ${mode === "dm" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          <MessageCircle className="w-3 h-3" /> Direct
        </button>
        <button
          onClick={() => setMode("group")}
          className={`flex-1 px-2 py-1.5 rounded-md text-xs flex items-center justify-center gap-1 ${mode === "group" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          <Users className="w-3 h-3" /> Group
        </button>
      </div>

      {mode === "group" && (
        <Input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name (e.g. CSC 200L)"
          maxLength={60}
          className="mb-2"
        />
      )}

      {mode === "group" && picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {picked.map((p) => (
            <span key={p.id} className="bg-primary/10 text-primary text-[11px] rounded-full pl-1 pr-2 py-0.5 flex items-center gap-1">
              <AvatarDisplay avatarKey={p.avatar_key} size={16} />
              {p.display_name}
              <button onClick={() => togglePick(p)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" className="pl-8" />
      </div>

      <div className="mt-2 overflow-y-auto flex-1">
        {debounced.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Type a name to search students.</p>
        )}
        {debounced.length > 0 && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No students match "{debounced}".</p>
        )}
        {results.map((r) => {
          const isPicked = picked.some((p) => p.id === r.id);
          return (
            <button
              key={r.id}
              onClick={() => (mode === "dm" ? startDm(r.id) : togglePick(r))}
              className={`w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-left ${isPicked ? "bg-primary/5" : ""}`}
            >
              <AvatarDisplay avatarKey={r.avatar_key} size={32} />
              <span className="text-sm font-medium truncate flex-1">{r.display_name}</span>
              {mode === "group" && isPicked && <Check className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mt-2">
        <Button variant="ghost" size="sm" onClick={reset} className="flex-1">
          Cancel
        </Button>
        {mode === "group" && (
          <Button size="sm" onClick={createGroup} disabled={saving || !groupName.trim() || picked.length === 0} className="flex-1">
            {saving ? "Creating…" : `Create (${picked.length})`}
          </Button>
        )}
      </div>
    </div>
  );
}

function AddMembersButton({ threadId, existingIds }: { threadId: string; existingIds: string[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [] } = useQuery<ProfileLite[]>({
    queryKey: ["dm-add-search", debounced, existingIds.join(",")],
    enabled: open && debounced.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_key,show_online,last_seen_at")
        .ilike("display_name", `%${debounced}%`)
        .limit(20);
      return ((data ?? []) as ProfileLite[]).filter((p) => !existingIds.includes(p.id));
    },
  });

  const add = async (userId: string) => {
    const { error } = await supabase.from("dm_thread_members").insert({ thread_id: threadId, user_id: userId, role: "member" });
    if (error) return toast.error(error.message);
    toast.success("Member added");
    qc.invalidateQueries({ queryKey: ["dm", threadId] });
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="w-full">
        <UserPlus className="w-4 h-4 mr-1" /> Add members
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search to add…" className="pl-8" />
      </div>
      <div className="max-h-48 overflow-y-auto bg-card rounded-lg border">
        {results.map((r) => (
          <button key={r.id} onClick={() => add(r.id)} className="w-full flex items-center gap-2 p-2 hover:bg-muted text-left">
            <AvatarDisplay avatarKey={r.avatar_key} size={28} />
            <span className="text-sm font-medium truncate flex-1">{r.display_name}</span>
            <UserPlus className="w-4 h-4 text-primary" />
          </button>
        ))}
        {debounced.length > 0 && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No matches.</p>
        )}
      </div>
      <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setQ(""); }} className="w-full">
        Done
      </Button>
    </div>
  );
}

/* ---------------- Campus / Nearby ---------------- */

type ChatRow = {
  id: string;
  created_at: string;
  author_id: string;
  body: string;
  scope: string;
  lat: number | null;
  lng: number | null;
  profile?: { display_name: string; avatar_key: string } | null;
  distance_km?: number;
};

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function RoomView({ meId, scope }: { meId: string; scope: "global" | "nearby" }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery<ChatRow[]>({
    queryKey: ["chat", scope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, created_at, author_id, body, scope, lat, lng")
        .eq("scope", scope)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((m) => m.author_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, display_name, avatar_key").in("id", ids)).data ?? []
        : [];
      const map = new Map(profiles.map((p: any) => [p.id, p]));
      return ((data ?? []) as ChatRow[]).map((m) => ({ ...m, profile: map.get(m.author_id) ?? null })).reverse();
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`chat-${scope}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `scope=eq.${scope}` },
        () => qc.invalidateQueries({ queryKey: ["chat", scope] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [scope, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        toast.success("Location locked in");
      },
      (err) => toast.error(err.message || "Could not get location"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const filtered = useMemo(() => {
    if (scope !== "nearby" || !coords) return messages;
    return messages
      .filter((m) => m.lat != null && m.lng != null)
      .map((m) => ({ ...m, distance_km: haversine(coords, { lat: m.lat!, lng: m.lng! }) }))
      .filter((m) => (m.distance_km ?? Infinity) <= radiusKm);
  }, [messages, scope, coords, radiusKm]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    if (scope === "nearby" && !coords) return toast.error("Share your location first");
    setText("");
    const payload: any = { author_id: meId, body, scope };
    if (scope === "nearby" && coords) {
      payload.lat = coords.lat;
      payload.lng = coords.lng;
    }
    const { error } = await supabase.from("chat_messages").insert(payload);
    if (error) {
      toast.error(error.message);
      setText(body);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-card border rounded-2xl overflow-hidden">
      {scope === "nearby" && (
        <div className="p-3 border-b flex items-center gap-3 flex-wrap">
          {coords ? (
            <>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Navigation className="w-3 h-3" /> {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
              </span>
              <label className="text-xs flex items-center gap-2 flex-1 min-w-[180px]">
                Radius: <strong>{radiusKm} km</strong>
                <input type="range" min={1} max={50} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="flex-1" />
              </label>
            </>
          ) : (
            <Button size="sm" onClick={requestLocation}>
              <MapPin className="w-4 h-4 mr-1" /> Share my location
            </Button>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/30">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            {scope === "nearby" && !coords
              ? "Share your location to see students chatting nearby."
              : "No messages yet. Be the first to say hi!"}
          </div>
        ) : (
          filtered.map((m) => {
            const mine = m.author_id === meId;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <Link to="/profile/$id" params={{ id: m.author_id }}>
                  <AvatarDisplay avatarKey={m.profile?.avatar_key ?? "boy-1"} size={32} />
                </Link>
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <div className="text-[11px] text-muted-foreground mb-0.5">
                    <span className="font-semibold">{m.profile?.display_name ?? "Student"}</span>
                    <span> · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                    {m.distance_km != null && <span> · {m.distance_km.toFixed(1)} km</span>}
                  </div>
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm break-words ${
                      mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border rounded-bl-sm"
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t p-2 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={1000} />
        <Button type="submit" disabled={!text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
