import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, BookmarkPlus, Camera, ImageIcon, Send, Download, X, Sparkles, MessageSquareWarning, Eye, EyeOff } from "lucide-react";
import { postFromScan } from "@/lib/post-from-scan.functions";
import { extractTextFromImage, submitOcrCorrection } from "@/lib/ocr.functions";
import { OcrLoadingState } from "@/components/OcrLoadingState";
import { MathText } from "@/components/MathText";
import { pdfToImages } from "@/lib/pdf-to-images";


export const Route = createFileRoute("/tools/ocr")({ component: OcrTool });

const SS_KEY = "ocr_tool_state_v2";

type Persisted = { dataUrl?: string; fileName?: string; title?: string; text?: string; original?: string };

function loadPersisted(): Persisted {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(sessionStorage.getItem(SS_KEY) || "{}"); } catch { return {}; }
}
function savePersisted(p: Persisted) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(p)); } catch {}
}
function clearPersisted() {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(SS_KEY); } catch {}
}

function dataUrlToFile(dataUrl: string, name: string): File | null {
  try {
    const [meta, b64] = dataUrl.split(",");
    const mime = /data:([^;]+);/.exec(meta)?.[1] || "image/png";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  } catch { return null; }
}

async function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

function OcrTool() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [originalText, setOriginalText] = useState(""); // unedited model output, for feedback diff
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const postScan = useServerFn(postFromScan);
  const runOcr = useServerFn(extractTextFromImage);
  const sendCorrection = useServerFn(submitOcrCorrection);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [restored, setRestored] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

  // Bug 4 — restore selection across refresh
  useEffect(() => {
    const p = loadPersisted();
    if (p.dataUrl) {
      setPreview(p.dataUrl);
      const f = dataUrlToFile(p.dataUrl, p.fileName || "restored.png");
      if (f) setFile(f);
      setRestored(true);
    }
    if (p.title) setTitle(p.title);
    if (p.text) setText(p.text);
    if (p.original) setOriginalText(p.original);
  }, []);

  useEffect(() => {
    if (restored) {
      toast.info("Restored your last image");
      setRestored(false);
    }
  }, [restored]);

  const pick = async (f: File | null) => {
    setText(""); setOriginalText("");
    if (!f) { setFile(null); setPreview(null); clearPersisted(); return; }
    setFile(f);
    const name = f.name.replace(/\.[^.]+$/, "");
    setTitle(name);
    const url = await fileToDataUrl(f);
    setPreview(url);
    savePersisted({ dataUrl: url, fileName: f.name, title: name, text: "" });
  };

  const onPickInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    pick(f);
    e.target.value = ""; // allow re-pick same file (Bug 5)
  };

  const clear = () => {
    setFile(null); setPreview(null); setText(""); setOriginalText(""); setTitle("");
    clearPersisted();
  };

  const logFailure = async (msg: string) => {
    if (!user) return;
    try {
      await supabase.from("tool_failure_log").insert({
        user_id: user.id,
        tool_name: "image_to_text",
        error_message: msg,
        metadata: { fileName: file?.name, size: file?.size },
      });
    } catch {}
  };

  const run = async () => {
    if (!user) return toast.error("Sign in first");
    if (!file || !preview) return toast.error("Pick an image or PDF first");
    setBusy(true);
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      let extracted = "";
      let totalElapsed = 0;
      let modelUsed = "";

      if (isPdf) {
        setPdfProgress({ done: 0, total: 1 });
        const pages = await pdfToImages(file, {
          maxPages: 20,
          scale: 2,
          onProgress: (done, total) => setPdfProgress({ done, total }),
        });
        if (pages.length === 0) {
          toast.error("Could not read PDF. No credit was deducted.");
          return;
        }
        const parts: string[] = [];
        for (const pg of pages) {
          setPdfProgress({ done: pg.page - 1, total: pages.length });
          const r = await runOcr({ data: { imageDataUrl: pg.dataUrl, mimeType: "image/png" } });
          if (!r.ok) {
            await logFailure(`page ${pg.page}: ${r.error}`);
            toast.error(`Page ${pg.page}: ${r.error} No credit was deducted.`);
            return;
          }
          parts.push(pages.length > 1 ? `--- Page ${pg.page} ---\n${r.text}` : r.text);
          totalElapsed += r.elapsedMs;
          modelUsed = r.model;
          setPdfProgress({ done: pg.page, total: pages.length });
        }
        extracted = parts.join("\n\n");
      } else {
        const r = await runOcr({
          data: { imageDataUrl: preview, mimeType: file.type || "image/png" },
        });
        if (!r.ok) {
          await logFailure(r.error);
          toast.error(`${r.error} No credit was deducted.`);
          return;
        }
        extracted = r.text;
        totalElapsed = r.elapsedMs;
        modelUsed = r.model;
      }

      // Only deduct AFTER success
      try {
        const { error } = await supabase.rpc("spend_credits", {
          _amount: 10,
          _reason: "tool:image_to_text",
          _metadata: { name: file.name, model: modelUsed, elapsedMs: totalElapsed, isPdf },
        });
        if (error) {
          if (error.message.includes("INSUFFICIENT_CREDITS")) toast.error("Not enough credits — but here's your text anyway");
          else toast.error(error.message);
        } else {
          toast.success(`Done in ${(totalElapsed / 1000).toFixed(1)}s · −10 credits`);
          refreshProfile();
        }
      } catch (e: any) {
        toast.error(e?.message || "Credit charge failed");
      }

      setText(extracted);
      setOriginalText(extracted);
      savePersisted({
        dataUrl: preview, fileName: file.name, title, text: extracted, original: extracted,
      });
    } catch (e: any) {
      const msg = e?.message || "Scanner crashed";
      await logFailure(msg);
      toast.error(`${msg}. No credit was deducted.`);
    } finally {
      setBusy(false);
      setPdfProgress(null);
    }
  };

  const saveAsNote = async () => {
    if (!user) return toast.error("Sign in first");
    if (!text.trim()) return toast.error("Nothing to save");
    if (!title.trim()) return toast.error("Give it a title");
    setSaving(true);
    try {
      const { error } = await supabase.from("study_notes").insert({
        uploader_id: user.id,
        title: title.trim(),
        body: text.trim(),
      });
      if (error) throw error;
      toast.success("Saved to Study Notes");
      clearPersisted();
      navigate({ to: "/notes" });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const reportError = async () => {
    if (!user) return toast.error("Sign in first");
    if (!text.trim() || !originalText.trim()) return;
    if (text.trim() === originalText.trim() && !reportNote.trim()) {
      return toast.error("Edit the text first, or add a note explaining the error.");
    }
    setReporting(true);
    try {
      const r = await sendCorrection({
        data: {
          originalText: originalText,
          correctedText: text,
          note: reportNote.trim() || undefined,
        },
      });
      if (!r.ok) throw new Error(r.error);
      toast.success("Thanks! Your correction will help us improve.");
      setReportNote("");
    } catch (e: any) {
      toast.error(e?.message || "Could not submit feedback");
    } finally {
      setReporting(false);
    }
  };

  // Persist edits
  useEffect(() => {
    if (!preview) return;
    const p = loadPersisted();
    savePersisted({ ...p, title, text });
  }, [title, text, preview]);

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4 animate-fade-in-up">
      <Link to="/tools" className="text-xs text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />All tools</Link>
      <div>
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          Image / PDF → Text
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-accent text-primary inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" />AI · LaTeX-aware
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Snap a page or pick from your gallery. Handwriting, printed text, math formulas — all converted with LaTeX.
          Credits charged only on success.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Add an image</Label>
        {/* Bug 5 — gallery picker (no capture attr so it opens the file browser) */}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPickInput} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickInput} />
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()}>
            <Camera className="w-4 h-4 mr-2" />Take photo
          </Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="w-4 h-4 mr-2" />Image or PDF
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">PDFs are scanned page by page (up to 20 pages).</p>
        {file && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{file.name}</span>
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-destructive hover:underline">
              <X className="w-3 h-3" />Clear
            </button>
          </div>
        )}
      </div>
      <Button onClick={run} disabled={busy || !file} className="w-full">
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Working…</> : "Extract text (−10 on success)"}
      </Button>

      {busy && <OcrLoadingState />}
      {busy && pdfProgress && pdfProgress.total > 1 && (
        <p className="text-xs text-center text-muted-foreground">
          Scanning page {pdfProgress.done} of {pdfProgress.total}…
        </p>
      )}

      {text && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Rendered preview</Label>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}>
                <Copy className="w-3 h-3 mr-1" />Copy
              </Button>
            </div>
            <div className="rounded-md bg-background p-3 border">
              <MathText>{text}</MathText>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Equations wrapped in <code>$…$</code> render as proper formulas. To edit, expand "Spot a mistake?" below.
            </p>
          </div>




          {/* Feedback loop — Feature 15 / Bug 9b */}
          <details className="rounded-xl border bg-muted/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold inline-flex items-center gap-1">
              <MessageSquareWarning className="w-4 h-4 text-primary" />
              Spot a mistake? Help us improve
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Edit the extracted text below to fix any errors, then submit. Your correction trains the scanner.
              </p>
              <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" />
              <Input
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="Optional: describe the error (e.g. 'misread H₂O as H2O')"
                maxLength={500}
              />

              <Button size="sm" variant="secondary" onClick={reportError} disabled={reporting}>
                {reporting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                Submit correction
              </Button>
            </div>
          </details>

          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-accent p-4 space-y-3">
            <Label>Title for this scan</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. CSC 201 — Chapter 3)" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button onClick={saveAsNote} disabled={saving} variant="secondary">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookmarkPlus className="w-4 h-4 mr-2" />}
                Save note
              </Button>
              <Button
                onClick={async () => {
                  if (!user) return toast.error("Sign in first");
                  if (!text.trim() || !title.trim()) return toast.error("Need title and text");
                  setPosting(true);
                  try {
                    const r = await postScan({ data: { title: title.trim(), body: text.trim() } });
                    toast.success("Posted to feed");
                    clearPersisted();
                    navigate({ to: "/post/$id", params: { id: r.id } });
                  } catch (e: any) {
                    toast.error(e?.message ?? "Could not post");
                  } finally { setPosting(false); }
                }}
                disabled={posting}
              >
                {posting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Post to feed
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${(title || "scan").replace(/[^a-z0-9_-]+/gi, "_")}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Downloaded");
                }}
              >
                <Download className="w-4 h-4 mr-2" />Download
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Post to feed auto-generates a cover image that matches what you scanned.</p>
          </div>
        </div>
      )}
    </div>
  );
}
