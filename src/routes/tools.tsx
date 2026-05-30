import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Coins, FileText, ScanLine, ImageDown } from "lucide-react";

export const Route = createFileRoute("/tools")({ component: ToolsLayout });

const TOOLS = [
  { to: "/tools/pdf", label: "Text → PDF", desc: "Turn your notes into a clean PDF", icon: FileText, cost: 10 },
  { to: "/tools/ocr", label: "Image → Text", desc: "Extract text from a photo or screenshot", icon: ImageDown, cost: 10 },
  { to: "/tools/qr", label: "QR / Ticket Scanner", desc: "Validate event tickets", icon: ScanLine, cost: 0 },
] as const;

function ToolsLayout() {
  const { profile, user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onHub = path === "/tools";

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold font-display">Tools Plug</h1>
            <p className="text-sm text-muted-foreground">Small utilities. Some cost credits.</p>
          </div>
          {user && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/10 to-accent border">
              <Coins className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold">{profile?.credits ?? 0}</span>
              <span className="text-xs text-muted-foreground">credits</span>
            </div>
          )}
        </header>

        {onHub ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {TOOLS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="group bg-card border rounded-2xl p-5 shadow-card hover:shadow-glow hover:-translate-y-0.5 transition flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center shrink-0">
                  <t.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold font-display">{t.label}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.cost === 0 ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                      {t.cost === 0 ? "FREE" : `-${t.cost}`}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </AppShell>
  );
}