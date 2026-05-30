import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Ticket as TicketIcon, ShoppingCart, CheckCircle2 } from "lucide-react";
import QRCode from "qrcode";

export const Route = createFileRoute("/tickets/$id")({ component: TicketDetail });

function TicketDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const { data: t, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => (await supabase.from("tickets").select("*, uploader:profiles!tickets_uploader_id_fkey(display_name)").eq("id", id).maybeSingle()).data,
  });

  useEffect(() => {
    if (t?.qr_token && t?.buyer_id === user?.id) {
      QRCode.toDataURL(`SP-TICKET:${t.qr_token}`, { width: 260 }).then(setQr);
    }
  }, [t, user]);

  const buy = async () => {
    if (!user) { nav({ to: "/login" }); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("buy_ticket", { _ticket_id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket purchased!");
    qc.invalidateQueries({ queryKey: ["ticket", id] });
    if ((data as any)?.qr_token) QRCode.toDataURL(`SP-TICKET:${(data as any).qr_token}`, { width: 260 }).then(setQr);
  };

  if (isLoading) return <AppShell><p>Loading…</p></AppShell>;
  if (!t) return <AppShell><p>Not found.</p></AppShell>;

  const ownsIt = t.buyer_id === user?.id;

  return (
    <AppShell>
      <div className="space-y-4 max-w-xl mx-auto">
        <Link to="/tickets" className="text-xs text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />All tickets</Link>
        <div className="bg-card border rounded-3xl overflow-hidden shadow-card">
          <img src={t.photo_url} alt={t.title} className="w-full h-72 object-cover" />
          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold font-display">{t.title}</h1>
              <span className="text-primary font-bold text-xl whitespace-nowrap">
                {t.pay_mode === "credits" ? `${t.price} cr` : `₦${Number(t.price).toLocaleString()}`}
              </span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.description}</p>
            <p className="text-xs text-muted-foreground">Sold by {(t as any).uploader?.display_name ?? "—"}</p>

            {t.is_sold && !ownsIt && (
              <div className="bg-muted rounded-xl p-3 text-sm text-center">This ticket has been sold.</div>
            )}
            {ownsIt && (
              <div className="bg-success/10 border border-success/40 rounded-xl p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 font-bold text-success"><CheckCircle2 className="w-5 h-5" />You own this ticket</div>
                {qr && <img src={qr} alt="QR code" className="mx-auto" />}
                <p className="text-xs text-muted-foreground break-all">Show this QR at the entrance.</p>
              </div>
            )}
            {!t.is_sold && (
              t.pay_mode === "contact" ? (
                <>
                  <Button onClick={buy} disabled={busy} className="w-full"><TicketIcon className="w-4 h-4 mr-1" />Reserve & get QR</Button>
                  {t.contact && <p className="text-xs text-center text-muted-foreground">Then pay seller via: <strong>{t.contact}</strong></p>}
                </>
              ) : (
                <Button onClick={buy} disabled={busy} className="w-full"><ShoppingCart className="w-4 h-4 mr-1" />Buy with {t.price} credits</Button>
              )
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
