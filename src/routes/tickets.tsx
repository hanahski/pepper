import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Ticket, Upload, ShieldCheck, QrCode, ArrowLeft, Lock } from "lucide-react";
import QRCode from "qrcode";

export const Route = createFileRoute("/tickets")({ component: TicketsPage });

function TicketsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"browse" | "upload" | "mine">("browse");

  const { data: profile } = useQuery({
    queryKey: ["me-profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("rank_tier,is_verified").eq("id", user!.id).maybeSingle()).data,
  });
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => !!(await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle()).data,
  });

  const canUpload = !!isAdmin || (!!profile?.is_verified && (profile?.rank_tier === "pro" || profile?.rank_tier === "sure_plug"));

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-fuchsia-500 to-rose-500 text-white rounded-3xl p-6 shadow-card">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Ticket className="w-7 h-7" />Ticket Marketplace</h1>
              <p className="text-sm opacity-90 mt-1">Buy & sell event tickets. Only verified Star users can sell.</p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link to="/tools/qr"><QrCode className="w-4 h-4 mr-1" />Scan ticket</Link>
            </Button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { k: "browse", label: "Browse" },
            { k: "upload", label: canUpload ? "Upload" : "Upload (locked)" },
            { k: "mine", label: "My purchases" },
          ].map(({ k, label }) => (
            <button key={k} onClick={() => setTab(k as typeof tab)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${tab === k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "browse" && <BrowseTickets />}
        {tab === "upload" && (canUpload ? <UploadTicket userId={user?.id} /> : <LockedUpload />)}
        {tab === "mine" && <MyPurchases userId={user?.id} />}
      </div>
    </AppShell>
  );
}

function BrowseTickets() {
  const { data, isLoading } = useQuery({
    queryKey: ["tickets-browse"],
    queryFn: async () => (await supabase.from("tickets").select("*").eq("is_sold", false).order("created_at", { ascending: false }).limit(60)).data ?? [],
  });
  if (isLoading) return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  if (!data?.length) return <div className="text-center py-12 text-muted-foreground"><Ticket className="w-10 h-10 mx-auto mb-2 opacity-40" />No tickets for sale right now.</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((t) => (
        <Link key={t.id} to="/tickets/$id" params={{ id: t.id }} className="bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-glow transition">
          <img src={t.photo_url} alt={t.title} className="w-full h-44 object-cover" />
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold line-clamp-1">{t.title}</h3>
              <span className="text-primary font-bold whitespace-nowrap">{t.pay_mode === "credits" ? `${t.price} cr` : `₦${Number(t.price).toLocaleString()}`}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function LockedUpload() {
  return (
    <div className="bg-card border-2 border-dashed rounded-2xl p-8 text-center space-y-3">
      <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
      <h3 className="font-bold font-display text-lg">Upload locked</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Only <strong>verified</strong> users at <strong>Pro</strong> or <strong>Sure Plug</strong> rank can sell tickets.
        Keep posting approved content to rank up, and ask an admin to verify your account.
      </p>
    </div>
  );
}

function UploadTicket({ userId }: { userId?: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("0");
  const [payMode, setPayMode] = useState<"contact" | "credits">("contact");
  const [contact, setContact] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !file) { toast.error("Add a ticket photo first"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("tickets").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("tickets").getPublicUrl(path);
      const ins = await supabase.from("tickets").insert({
        uploader_id: userId, title, description: desc, photo_url: pub.publicUrl,
        price: Number(price) || 0, pay_mode: payMode, contact: contact || null,
      });
      if (ins.error) throw ins.error;
      toast.success("Ticket listed");
      qc.invalidateQueries({ queryKey: ["tickets-browse"] });
      nav({ to: "/tickets" });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="bg-card border rounded-2xl p-5 space-y-4">
      <h2 className="font-bold font-display text-lg flex items-center gap-2"><Upload className="w-5 h-5 text-primary" />List a ticket</h2>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ticket title (e.g. EBSU Cultural Night)" required maxLength={120} />
      <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Event details, date, venue, seat info…" rows={3} maxLength={1000} />
      <div className="grid grid-cols-2 gap-3">
        <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" required />
        <Select value={payMode} onValueChange={(v) => setPayMode(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contact">Contact seller (₦)</SelectItem>
            <SelectItem value="credits">In-app credits</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {payMode === "contact" && (
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Your WhatsApp / phone" maxLength={120} />
      )}
      <div>
        <label className="block text-sm font-medium mb-1">Ticket photo</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" required />
      </div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Uploading…" : "Publish ticket"}</Button>
    </form>
  );
}

function MyPurchases({ userId }: { userId?: string }) {
  const { data } = useQuery({
    queryKey: ["my-tickets", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("ticket_purchases").select("*, ticket:tickets(*)").eq("buyer_id", userId!).order("created_at", { ascending: false })).data ?? [],
  });
  if (!userId) return <p className="text-muted-foreground text-sm">Sign in to view your tickets.</p>;
  if (!data?.length) return <p className="text-muted-foreground text-sm text-center py-8">No purchases yet.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {data.map((p: any) => <PurchasedTicket key={p.id} p={p} />)}
    </div>
  );
}

function PurchasedTicket({ p }: { p: any }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => { QRCode.toDataURL(`SP-TICKET:${p.qr_token}`, { width: 220 }).then(setQr); }, [p.qr_token]);
  return (
    <div className="bg-card border rounded-2xl p-4 shadow-card">
      <h3 className="font-semibold">{p.ticket?.title}</h3>
      <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
      {qr && <img src={qr} alt="QR" className="mt-3 mx-auto" />}
      <p className="text-xs text-center text-muted-foreground mt-2 break-all">{p.qr_token}</p>
    </div>
  );
}
