import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/market/new")({
  component: NewListing,
  validateSearch: (s: Record<string, unknown>) => ({ kind: (s.kind as string) || "product" }),
});

const KIND_OPTIONS = ["tickets", "products", "books", "advert"];

function NewListing() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);

  const search = Route.useSearch();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [cat, setCat] = useState("other");
  const [kind, setKind] = useState<string>(search.kind ?? "products");
  const [contact, setContact] = useState("");
  const [loc, setLoc] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!title.trim() || !contact.trim()) { toast.error("Title and contact are required"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("market_listings").insert({
      seller_id: user.id, title: title.trim(), description: desc.trim() || null,
      price: Number(price) || 0, category: cat, contact: contact.trim(), location: loc.trim() || null,
      listing_kind: kind,
    } as any).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing posted!");
    nav({ to: "/market/$id", params: { id: data.id } });
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto bg-card border rounded-3xl p-6 shadow-card space-y-4">
        <h1 className="text-2xl font-bold font-display">Post a listing</h1>
        <div>
          <Label>Listing type *</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Used HP laptop, perfect condition" /></div>
        <div><Label>Description</Label><Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Price (₦)</Label><Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div>
            <Label>Category</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["books","electronics","fashion","services","hostel","other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Contact * (phone, WhatsApp, or @username)</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. 0801 234 5678" /></div>
        <div><Label>Location</Label><Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. CAS Campus, Abakaliki" /></div>
        <Button onClick={submit} disabled={saving} className="w-full">{saving ? "Posting…" : "Post listing"}</Button>
      </div>
    </AppShell>
  );
}