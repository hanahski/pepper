import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tools/qr")({ component: QrScanner });

function QrScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ value: string; ok: boolean; meta?: any } | null>(null);
  const regionId = "qr-region";

  const teardown = async () => {
    const s = scannerRef.current;
    if (!s) return;
    scannerRef.current = null;
    try { await s.stop(); } catch {}
    try { s.clear(); } catch {}
  };

  const start = async () => {
    setResult(null);
    await teardown();
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decoded) => {
          await teardown();
          setScanning(false);
          const token = decoded.startsWith("SP-TICKET:") ? decoded.slice("SP-TICKET:".length) : decoded;
          const { data } = await supabase.rpc("verify_ticket", { _qr_token: token });
          const valid = (data as any)?.valid === true;
          setResult({ value: decoded, ok: valid, meta: data });
        },
        () => {},
      );
      setScanning(true);
    } catch (e: any) {
      toast.error(e?.message || "Cannot access camera");
      scannerRef.current = null;
    }
  };

  const stop = async () => {
    await teardown();
    setScanning(false);
  };

  useEffect(() => () => { void teardown(); }, []);

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4 max-w-xl mx-auto">
      <Link to="/tools" className="text-xs text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />All tools</Link>
      <div>
        <h2 className="text-xl font-bold font-display">QR / Ticket Scanner</h2>
        <p className="text-sm text-muted-foreground">Validates tickets purchased on Market Plug.</p>
      </div>

      <div className="rounded-xl overflow-hidden border bg-black/5 min-h-[260px] relative">
        <div id={regionId} className="w-full" />
        {scanning && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[260px] h-[260px] border-2 border-primary rounded-2xl shadow-glow animate-pulse" />
          </div>
        )}
        {!scanning && !result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2 pointer-events-none">
            <Camera className="w-10 h-10 opacity-50" />
            <p>Camera preview will appear here.</p>
          </div>
        )}
      </div>

      {!scanning ? (
        <Button onClick={start} className="w-full"><Camera className="w-4 h-4 mr-2" />Start scanning</Button>
      ) : (
        <Button onClick={stop} variant="outline" className="w-full">Stop</Button>
      )}

      {result && (
        <div className={`rounded-xl border p-4 ${result.ok ? "bg-success/10 border-success/40" : "bg-destructive/10 border-destructive/40"}`}>
          <div className="flex items-center gap-2 font-bold">
            {result.ok ? <CheckCircle2 className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
            {result.ok ? "Valid ticket" : "Invalid or unknown ticket"}
          </div>
          {result.ok && result.meta && (
            <div className="text-sm mt-2 space-y-0.5">
              <div><strong>Event:</strong> {result.meta.title}</div>
              <div><strong>Holder:</strong> {result.meta.buyer ?? "—"}</div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1 break-all">{result.value}</p>
        </div>
      )}
    </div>
  );
}