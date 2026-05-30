// Downloads an external PDF for a library_book and mirrors it to the book-pdfs bucket.
// Idempotent: if the row already points at our bucket, we just return that URL.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "book-pdfs";

async function resolvePdfUrl(sourceUrl: string): Promise<string | null> {
  if (/\.pdf(\?|#|$)/i.test(sourceUrl)) return sourceUrl;
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "StudentsPlug/1.0 (+pdf-resolver)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("pdf")) return res.url;
    if (!ct.includes("html")) return null;
    const html = await res.text();
    const base = new URL(res.url);
    const matches = Array.from(html.matchAll(/href\s*=\s*["']([^"'<>]+\.pdf(?:\?[^"'<>]*)?)["']/gi));
    for (const m of matches) {
      try {
        return new URL(m[1], base).toString();
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}


async function cacheById(id: string) {
  const { data: book, error } = await supabaseAdmin
    .from("library_books")
    .select("id, read_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!book) return { ok: false, error: "not_found" as const };
  if (!book.read_url) return { ok: false, error: "no_source" as const };

  // Already cached?
  if (book.read_url.includes(`/${BUCKET}/`)) {
    return { ok: true, cached_url: book.read_url, already: true };
  }

  // Resolve actual PDF URL (handles HTML index pages like freebookcentre.net)
  const pdfUrl = await resolvePdfUrl(book.read_url);
  if (!pdfUrl) return { ok: false, error: "no_pdf_found" };

  const res = await fetch(pdfUrl, {
    headers: { "User-Agent": "StudentsPlug/1.0 (+pdf-cache)" },
    redirect: "follow",
  });
  if (!res.ok) return { ok: false, error: `fetch_${res.status}` };
  const ct = res.headers.get("content-type") ?? "";
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!ct.includes("pdf") && !(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) {
    return { ok: false, error: "not_a_pdf" };
  }

  const path = `${book.id}.pdf`;
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (up.error) return { ok: false, error: `upload: ${up.error.message}` };

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const cached = pub.publicUrl;
  await supabaseAdmin.from("library_books").update({ read_url: cached }).eq("id", book.id);
  return { ok: true, cached_url: cached, already: false };
}

export const Route = createFileRoute("/api/public/hooks/cache-book-pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return Response.json({ ok: false, error: "missing id" }, { status: 400 });
        try {
          const out = await cacheById(id);
          return Response.json(out, { status: out.ok ? 200 : 400 });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
