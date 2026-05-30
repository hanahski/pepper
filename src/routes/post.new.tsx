import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ScanLine, Eye, ShieldCheck, ShieldAlert } from "lucide-react";
import { MathText } from "@/components/MathText";
import { MediaPlayer } from "@/components/MediaPlayer";
import { extractTextFromImage } from "@/lib/ocr.functions";
import { pdfToImages } from "@/lib/pdf-to-images";
import { enhanceImageFile } from "@/lib/image-enhance";
import { VerifyStudentDialog } from "@/components/VerifyStudentDialog";

export const Route = createFileRoute("/post/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    course: (s.course as string) || "",
    type: (s.type as string) || "",
  }),
  component: NewPostPage,
});

type MediaKind = "image" | "video" | "audio";
function kindFor(file: File): MediaKind | "pdf" | "other" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "other";
}

function NewPostPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const { course: presetCourse, type: presetType } = Route.useSearch();
  const [type, setType] = useState(presetType || "general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState(presetCourse);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const runOcr = useServerFn(extractTextFromImage);
  const autoScannedRef = useRef<string | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login", search: { redirect: "/post/new" } }); }, [user, loading]);

  useEffect(() => {
    if (!mediaFile) { setMediaPreview(null); return; }
    const u = URL.createObjectURL(mediaFile);
    setMediaPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [mediaFile]);

  const { data: courses } = useQuery({
    queryKey: ["all-courses"],
    queryFn: async () => (await supabase.from("courses").select("id,code,title").order("code")).data ?? [],
  });

  const scanPdf = async (file: File) => {
    if (!user) return;
    setScanning(true);
    setScanProgress({ done: 0, total: 0 });
    try {
      const pages = await pdfToImages(file, {
        maxPages: 20,
        scale: 2,
        onProgress: (done, total) => setScanProgress({ done, total }),
      });
      if (!pages.length) { toast.error("Could not read PDF pages"); return; }
      const chunks: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        setScanProgress({ done: i, total: pages.length });
        const r = await runOcr({ data: { imageDataUrl: pages[i].dataUrl, mimeType: "image/png" } });
        chunks.push(`\n\n--- Page ${pages[i].page} ---\n\n${r.ok ? r.text : `[Could not read this page: ${r.error}]`}`);
      }
      const merged = chunks.join("").trim();
      setBody((prev) => (prev.trim() ? `${prev}\n\n${merged}` : merged));
      setShowPreview(true);
      toast.success(`Scanned ${pages.length} page${pages.length === 1 ? "" : "s"} into the body`);
    } catch (e: any) {
      console.error("pdf scan failed", e);
      toast.error(e?.message || "Could not scan PDF");
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  };

  // Auto-scan PDF as soon as it's attached (once per file)
  useEffect(() => {
    if (!pdfFile || !user) return;
    const sig = `${pdfFile.name}-${pdfFile.size}-${pdfFile.lastModified}`;
    if (autoScannedRef.current === sig) return;
    autoScannedRef.current = sig;
    void scanPdf(pdfFile);
  }, [pdfFile, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Please sign in first"); nav({ to: "/login" }); return; }
    if (!profile?.is_verified) {
      toast.error("Please verify you're an EBSU student before posting");
      setVerifyOpen(true);
      return;
    }
    if (!title.trim()) { toast.error("Title is required"); return; }
    setBusy(true);
    try {
      // PDF upload (private bucket)
      let file_url: string | null = null;
      let file_name: string | null = null;
      if (pdfFile) {
        const safe = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("post-files")
          .upload(path, pdfFile, { contentType: pdfFile.type || "application/pdf", upsert: false });
        if (upErr) throw upErr;
        file_url = path;
        file_name = pdfFile.name;
      }

      // Media upload (public bucket — full quality, no compression)
      let media_url: string | null = null;
      let media_type: MediaKind | null = null;
      if (mediaFile) {
        const k = kindFor(mediaFile);
        if (k === "image" || k === "video" || k === "audio") {
          let toUpload = mediaFile;
          if (k === "image") {
            const t = toast.loading("Enhancing image with AI…");
            toUpload = await enhanceImageFile(mediaFile);
            toast.dismiss(t);
            if (toUpload !== mediaFile) toast.success("Image enhanced");
          }
          const safe = toUpload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${user.id}/${Date.now()}-${safe}`;
          const { error: upErr } = await supabase.storage
            .from("post-media")
            .upload(path, toUpload, { contentType: toUpload.type, upsert: false });
          if (upErr) throw upErr;
          media_url = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
          media_type = k;
        }
      }

      const payload: any = {
        author_id: user.id,
        post_type: type,
        title: title.trim(),
        body: body.trim() || null,
        course_id: courseId || null,
        file_url,
        file_name,
        media_url,
        media_type,
        link_url: linkUrl.trim() || null,
      };
      const { data, error } = await supabase.from("posts").insert(payload).select("id").single();
      if (error) throw error;
      toast.success("Posted! +1 to your rank progress");
      nav({ to: "/post/$id", params: { id: data.id } });
    } catch (err: any) {
      console.error("post submit failed", err);
      toast.error(err?.message || "Could not publish. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold font-display mb-4">Create a post</h1>
        {profile && !profile.is_verified && (
          <div className="mb-4 border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-accent/10 to-background rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Verify you're an EBSU student to post</p>
              <p className="text-xs text-muted-foreground mt-0.5">Takes a few seconds with your JAMB registration number.</p>
              <Button size="sm" type="button" onClick={() => setVerifyOpen(true)} className="mt-2">
                <ShieldCheck className="w-4 h-4 mr-1.5" />Verify now
              </Button>
            </div>
          </div>
        )}
        <form onSubmit={submit} className="space-y-4 bg-card border rounded-2xl p-6 shadow-card">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General post</SelectItem>
                <SelectItem value="past_question">Past question</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="note">Note / study material</SelectItem>
                <SelectItem value="novel">Novel</SelectItem>
                <SelectItem value="news">News</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Course (optional)</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></div>

          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Body</Label>
              {body.trim() && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowPreview((v) => !v)}>
                  <Eye className="w-3 h-3 mr-1" />{showPreview ? "Edit" : "Preview"}
                </Button>
              )}
            </div>
            {showPreview ? (
              <div className="rounded-md border bg-background p-3 min-h-[200px]">
                <MathText>{body}</MathText>
              </div>
            ) : (
              <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your post. Equations in $…$ render as LaTeX." />
            )}
          </div>

          <div>
            <Label>Image, video, or audio (optional)</Label>
            <Input
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground mt-1">Uploaded at full quality. Videos and audio play inline.</p>
            {mediaFile && mediaPreview && (
              <div className="mt-3">
                <MediaPlayer
                  url={mediaPreview}
                  type={kindFor(mediaFile) as MediaKind}
                  title={mediaFile.name}
                />
              </div>
            )}
          </div>

          <div>
            <Label>Video link (YouTube, Vimeo, mp4 URL…)</Label>
            <Input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
            {linkUrl.trim() && (
              <div className="mt-3">
                <MediaPlayer url={linkUrl.trim()} type="video" />
              </div>
            )}
          </div>

          <div>
            <Label>Attach PDF (optional)</Label>
            <Input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
                  toast.error("Only PDF files are allowed here. Use the media field for images, video, audio.");
                  e.target.value = "";
                  return;
                }
                setPdfFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">PDFs are auto-scanned for extractable text on attach. Coursemates can read it inline.</p>
            {pdfFile && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => scanPdf(pdfFile)}
                disabled={scanning}
                className="mt-2 w-full"
              >
                {scanning ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning page {scanProgress?.done ?? 0}/{scanProgress?.total ?? "…"}</>
                ) : (
                  <><ScanLine className="w-4 h-4 mr-2" />Rescan PDF → text + LaTeX</>
                )}
              </Button>
            )}
          </div>

          <Button type="submit" disabled={busy || scanning} className="w-full">{busy ? "Posting…" : "Publish"}</Button>
        </form>
      </div>
      <VerifyStudentDialog open={verifyOpen} onOpenChange={setVerifyOpen} />
    </AppShell>
  );
}
