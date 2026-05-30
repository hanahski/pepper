import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Trash2, UserCog, ShoppingBag, FileText, Users } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPanel });

function AdminPanel() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"posts" | "listings" | "users">("posts");

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => !!(await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle()).data,
  });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading]);

  if (loading || roleLoading) return <AppShell><p>Loading…</p></AppShell>;
  if (!isAdmin) return <AppShell><div className="text-center py-16"><Shield className="w-12 h-12 mx-auto text-muted-foreground mb-2" /><p className="font-semibold">Admin access required</p></div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-card border rounded-3xl p-6 shadow-card">
          <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Shield className="w-6 h-6 text-primary" />Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Moderate content and manage users.</p>
          <div className="mt-4 flex gap-2 flex-wrap">
            {[
              { k: "posts", label: "Posts", icon: FileText },
              { k: "listings", label: "Listings", icon: ShoppingBag },
              { k: "users", label: "Users", icon: Users },
            ].map(({ k, label, icon: Icon }) => (
              <button key={k} onClick={() => setTab(k as typeof tab)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-1.5 transition ${tab === k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        {tab === "posts" && <AdminPosts />}
        {tab === "listings" && <AdminListings />}
        {tab === "users" && <AdminUsers />}
      </div>
    </AppShell>
  );
}

function AdminPosts() {
  const { data, refetch } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => (await supabase.from("posts").select("id,title,post_type,created_at,author_id,profiles:author_id(display_name)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const del = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refetch(); }
  };
  return (
    <div className="bg-card border rounded-2xl divide-y">
      {(data ?? []).map((p: any) => (
        <div key={p.id} className="p-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link to="/post/$id" params={{ id: p.id }} className="font-medium hover:text-primary line-clamp-1">{p.title}</Link>
            <p className="text-xs text-muted-foreground">{p.post_type} · {p.profiles?.display_name ?? "—"}</p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => del(p.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      ))}
    </div>
  );
}

function AdminListings() {
  const { data, refetch } = useQuery({
    queryKey: ["admin-listings"],
    queryFn: async () => (await supabase.from("market_listings").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const del = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("market_listings").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refetch(); }
  };
  return (
    <div className="bg-card border rounded-2xl divide-y">
      {(data ?? []).map((l) => (
        <div key={l.id} className="p-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link to="/market/$id" params={{ id: l.id }} className="font-medium hover:text-primary line-clamp-1">{l.title}</Link>
            <p className="text-xs text-muted-foreground">{l.category} · ₦{Number(l.price).toLocaleString()} {l.is_sold && "· SOLD"}</p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => del(l.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      ))}
    </div>
  );
}

function AdminUsers() {
  const [q, setQ] = useState("");
  const { data, refetch } = useQuery({
    queryKey: ["admin-users", q],
    queryFn: async () => {
      let query = supabase.from("profiles").select("id,display_name,email,credits,approved_post_count,rank_tier").order("approved_post_count", { ascending: false }).limit(100);
      if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
      return (await query).data ?? [];
    },
  });
  const { data: adminIds } = useQuery({
    queryKey: ["admin-ids"],
    queryFn: async () => new Set(((await supabase.from("user_roles").select("user_id").eq("role", "admin")).data ?? []).map((r) => r.user_id)),
  });

  const toggleAdmin = async (uid: string, currentlyAdmin: boolean) => {
    if (currentlyAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Admin removed");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Granted admin");
    }
    refetch();
  };

  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…" />
      <div className="bg-card border rounded-2xl divide-y">
        {(data ?? []).map((u) => {
          const isAdmin = adminIds?.has(u.id) ?? false;
          return (
            <div key={u.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link to="/profile/$id" params={{ id: u.id }} className="font-medium hover:text-primary line-clamp-1">{u.display_name} {isAdmin && <span className="text-xs text-primary">[admin]</span>}</Link>
                <p className="text-xs text-muted-foreground">{u.email} · {u.approved_post_count} posts · {u.credits} credits</p>
              </div>
              <Button size="sm" variant={isAdmin ? "destructive" : "outline"} onClick={() => toggleAdmin(u.id, isAdmin)}>
                <UserCog className="w-4 h-4 mr-1" />{isAdmin ? "Revoke" : "Make admin"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}