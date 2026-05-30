import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import { RankBadge } from "@/components/RankBadge";
import { AVATAR_KEYS, AVATARS, avatarDataUri } from "@/lib/avatars";
import { encouragement, nextLevelLabel, rankProgress } from "@/lib/ranks";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogOut, Copy, Gift, Coins, Camera, Ticket, Bookmark, ShieldCheck, ShieldAlert } from "lucide-react";
import { enhanceImageFile } from "@/lib/image-enhance";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvatarLightbox } from "@/components/AvatarLightbox";
import { VerifyStudentDialog } from "@/components/VerifyStudentDialog";

const ACADEMIC_LEVELS = ["100", "200", "300", "400", "500", "Postgraduate", "Alumni"];

export const Route = createFileRoute("/me")({ component: MePage });

function MePage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("boy-1");
  const [dept, setDept] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [showOnline, setShowOnline] = useState(true);
  const [code, setCode] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setBio(profile.bio ?? "");
      setAvatar(profile.avatar_key);
      setDept(profile.department_id ?? "");
      setLevel((profile as any).academic_level ?? "");
      setShowOnline(profile.show_online);
    }
  }, [profile]);

  const { data: depts } = useQuery({
    queryKey: ["all-depts"],
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });

  const { data: refStats } = useQuery({
    queryKey: ["refs", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, count } = await supabase.from("referrals").select("*", { count: "exact" }).eq("inviter_id", profile!.id);
      return { count: count ?? 0, list: data ?? [] };
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-extra", profile?.id],
    enabled: !!profile,
      queryFn: async () => (await supabase.from("profiles").select("referral_code").eq("id", profile!.id).maybeSingle()).data,
  });

  const redeem = async () => {
    if (!code.trim()) return;
    const trimmed = code.trim();
    const { data: adminData } = await supabase.rpc("claim_admin_coupon" as any, { _coupon: trimmed });
    if (adminData && (adminData as any).ok) {
      toast.success("Access upgraded.");
      setCode("");
      refreshProfile();
      return;
    }
    const { error } = await supabase.rpc("redeem_referral", { _code: trimmed });
    if (error) toast.error(error.message.replace(/.*: /, ""));
    else { toast.success("+50 credits! Your inviter got +100."); setCode(""); refreshProfile(); }
  };


  const redeemCoupon = async () => {
    if (!couponCode.trim()) return;
    const { data, error } = await supabase.rpc("redeem_coupon" as any, { _code: couponCode.trim() });
    if (error) { toast.error(error.message.replace(/.*: /, "")); return; }
    const r = data as any;
    if (r?.ok) {
      toast.success(r.message ?? "Code redeemed!");
      setCouponCode("");
      refreshProfile();
    } else {
      toast.error(r?.message ?? "Invalid code");
    }
  };

  const uploadCover = async (file: File) => {
    if (!profile) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Cover must be under 5MB"); return; }
    setCoverUploading(true);
    const t = toast.loading("Enhancing cover with AI…");
    try {
      const enhanced = await enhanceImageFile(file);
      toast.dismiss(t);
      if (enhanced !== file) toast.success("Cover enhanced");
      const ext = (enhanced.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${profile.id}/cover-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("covers").upload(path, enhanced, { upsert: true, contentType: enhanced.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
      const { error: updErr } = await supabase.from("profiles").update({ cover_url: pub.publicUrl } as any).eq("id", profile.id);
      if (updErr) throw updErr;
      toast.success("Cover updated");
      refreshProfile();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!profile) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
    setPhotoUploading(true);
    const t = toast.loading("Enhancing photo with AI…");
    try {
      const enhanced = await enhanceImageFile(file);
      toast.dismiss(t);
      if (enhanced !== file) toast.success("Photo enhanced");
      const ext = (enhanced.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("covers").upload(path, enhanced, { upsert: true, contentType: enhanced.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
      setAvatar(pub.publicUrl);
      const { error: updErr } = await supabase.from("profiles").update({ avatar_key: pub.publicUrl } as any).eq("id", profile.id);
      if (updErr) throw updErr;
      toast.success("Photo updated");
      refreshProfile();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const copyCode = () => {
    if (!myProfile?.referral_code) return;
    navigator.clipboard.writeText(myProfile.referral_code);
    toast.success("Code copied!");
  };

  if (!profile) return <AppShell><p>Loading…</p></AppShell>;
  const prog = rankProgress(profile.approved_post_count);

  const save = async () => {
    const { error } = await supabase.from("profiles").update({
      display_name: name, bio, avatar_key: avatar, department_id: dept || null,
      show_online: showOnline, academic_level: level || null,
    } as any).eq("id", profile.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile saved"); refreshProfile(); }
  };

  const coverUrl = (profile as any).cover_url as string | null;
  const hasPhoto = !!profile.avatar_key && profile.avatar_key.startsWith("http");
  const completionItems = [
    { label: "Add a bio", done: !!profile.bio },
    { label: "Pick your department", done: !!profile.department_id },
    { label: "Set your academic level", done: !!(profile as any).academic_level },
    { label: "Upload your photo", done: hasPhoto },
    { label: "Publish your first post", done: profile.approved_post_count > 0 },
  ];
  const completed = completionItems.filter((i) => i.done).length;
  const completionPct = Math.round((completed / completionItems.length) * 100);


  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="bg-card border rounded-3xl shadow-card overflow-hidden">
          <div
            className="relative h-32 sm:h-44 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 bg-cover bg-center"
            style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          >
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} />
            <button type="button" onClick={() => coverInputRef.current?.click()} disabled={coverUploading}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold border hover:bg-background">
              <Camera className="w-3.5 h-3.5" />{coverUploading ? "Uploading…" : coverUrl ? "Change cover" : "Add cover"}
            </button>
          </div>
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="View profile photo"
              >
                <AvatarDisplay avatarKey={profile.avatar_key} size={80} online={profile.show_online} />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold font-display break-words leading-tight inline-flex items-center gap-1.5">
                  {profile.display_name}
                  {profile.is_verified && <ShieldCheck className="w-5 h-5 text-primary shrink-0" aria-label="Verified EBSU student" />}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <RankBadge tier={profile.rank_tier} step={profile.rank_step} />
                  <span className="text-xs text-muted-foreground">{profile.approved_post_count} posts</span>
                  {(profile as any).academic_level && <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{(profile as any).academic_level} level</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ThemeToggle />
                <Button asChild variant="outline" size="sm"><Link to="/saved"><Bookmark className="w-4 h-4 mr-1" />Saved</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/bookshelf"><Library className="w-4 h-4 mr-1" />Bookshelf</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/profile/$id" params={{ id: profile.id }}>View public profile</Link></Button>
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
              <p className="text-xs text-primary mt-2 italic">{encouragement(profile.approved_post_count)}</p>
            </div>
          </div>
        </section>

        {!profile.is_verified && (
          <section className="border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-accent/10 to-background rounded-3xl shadow-glow p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold font-display text-lg">Verify you're an EBSU student</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Verified students can post content, download files, and unlock everything.
                  Unverified accounts are read-only.
                </p>
                <Button onClick={() => setVerifyOpen(true)} className="mt-3" size="sm">
                  <ShieldCheck className="w-4 h-4 mr-1.5" />Verify with JAMB reg number
                </Button>
              </div>
            </div>
          </section>
        )}

        {completionPct < 100 && (
          <section className="bg-card border rounded-3xl shadow-card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold font-display text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" />Complete your profile</h2>
              <span className="text-sm font-bold text-primary">{completionPct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div className="h-full bg-hero transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <ul className="grid sm:grid-cols-2 gap-1.5 text-sm">
              {completionItems.map((it) => (
                <li key={it.label} className={`flex items-center gap-2 ${it.done ? "text-muted-foreground line-through" : ""}`}>
                  <span className={`w-4 h-4 rounded-full border-2 inline-flex items-center justify-center text-[10px] ${it.done ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"}`}>{it.done ? "✓" : ""}</span>
                  {it.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-card border rounded-3xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold font-display text-lg flex items-center gap-2"><Gift className="w-5 h-5 text-primary" />Refer & Earn</h2>
            <span className="text-sm inline-flex items-center gap-1 font-semibold text-primary"><Coins className="w-4 h-4" />{profile.credits} credits</span>
          </div>
          <p className="text-sm text-muted-foreground">Share your code. You get <b>100 credits</b> for each friend who joins, and they get <b>50 credits</b> too.</p>
          <div>
            <Label>Your code</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={myProfile?.referral_code ?? "—"} className="font-mono font-bold tracking-widest text-center" />
              <Button variant="outline" onClick={copyCode}><Copy className="w-4 h-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{refStats?.count ?? 0} friends invited so far.</p>
          </div>
          <div>
            <Label>Got an invite code?</Label>
            <div className="flex gap-2 mt-1">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ENTER CODE" className="font-mono" maxLength={32} />
              <Button onClick={redeem}>Redeem</Button>
            </div>
          </div>
        </section>

        <section className="bg-card border rounded-3xl shadow-card p-6 space-y-4">
          <h2 className="font-bold font-display text-lg">Redeem Coupon</h2>
          <p className="text-sm text-muted-foreground">Enter a special access code to unlock features or bonuses.</p>
          <div className="flex gap-2">
            <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Enter code (e.g. youandgarri)" className="font-mono" maxLength={32} />
            <Button onClick={redeemCoupon}>Redeem</Button>
          </div>
        </section>

        <section className="bg-card border rounded-3xl shadow-card p-6 space-y-4">
          <h2 className="font-bold font-display text-lg">Edit profile</h2>
          <div>
            <Label>Your photo or avatar</Label>
            <div className="flex items-center gap-3 mt-2 mb-3">
              <img src={avatarDataUri(avatar)} alt="" style={{ width: 64, height: 64 }} className="block w-16 h-16 rounded-full border-2 border-primary object-cover aspect-square shrink-0" />
              <div className="flex flex-col gap-1.5">
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
                <Button type="button" size="sm" variant="outline" onClick={() => photoInputRef.current?.click()} disabled={photoUploading}>
                  <Camera className="w-4 h-4 mr-1.5" />{photoUploading ? "Uploading…" : "Upload photo"}
                </Button>
                <p className="text-xs text-muted-foreground">Or pick an avatar below</p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap mt-2">
              {AVATAR_KEYS.map((k) => (
                <button key={k} type="button" onClick={() => setAvatar(k)}
                  className={`p-1 rounded-full border-2 transition ${avatar === k ? "border-primary shadow-glow" : "border-transparent hover:border-muted"}`}>
                  <img src={avatarDataUri(k)} alt={AVATARS[k].label} className="w-12 h-12 rounded-full" />
                </button>
              ))}
            </div>
          </div>
          <div><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Department</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger><SelectValue placeholder="Select your department" /></SelectTrigger>
              <SelectContent>{depts?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Academic level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue placeholder="Select your level" /></SelectTrigger>
              <SelectContent>{ACADEMIC_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Bio</Label><Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
          <div className="flex items-center justify-between">
            <div><Label>Show online indicator</Label><p className="text-xs text-muted-foreground">Others see a green dot when you're active.</p></div>
            <Switch checked={showOnline} onCheckedChange={setShowOnline} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save}>Save changes</Button>
            <Button variant="outline" onClick={() => { signOut(); nav({ to: "/" }); }}><LogOut className="w-4 h-4 mr-1" />Sign out</Button>
          </div>
        </section>
      </div>
      <AvatarLightbox avatarKey={profile.avatar_key} open={photoOpen} onClose={() => setPhotoOpen(false)} />
      <VerifyStudentDialog open={verifyOpen} onOpenChange={setVerifyOpen} />
    </AppShell>
  );
}
