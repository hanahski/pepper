import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { PdfReader } from "@/components/PdfReader";
import { BookOpen, Loader2, Download, ExternalLink, Coins, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/books_/read/$id")({ component: ReadBookPage });

function parseGutenbergId(book: { openlibrary_key?: string | null; read_url?: string | null } | null | undefined): string | null {
  if (!book) return null;
  const k = book.openlibrary_key?.match(/^gutenberg-(\d+)$/i);
  if (k) return k[1];
  const u = book.read_url?.match(/gutenberg\.org\/(?:cache\/epub|files|ebooks)\/(\d+)/i);
  return u ? u[1] : null;
}


function ReadBookPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [readerOpen, setReaderOpen] = useState(false);
  const [cachedPdfUrl, setCachedPdfUrl] = useState<string | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);

  const { data: book, isLoading } = useQuery({
    queryKey: ["library-book", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("library_books").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: owned } = useQuery({
    queryKey: ["library-owned", id],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("library_book_purchases")
        .select("book_id")
        .eq("user_id", u.user.id)
        .eq("book_id", id)
        .maybeSingle();
      return !!data;
    },
  });

  const buy = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("purchase_library_book" as any, { _book_id: id });
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library-owned"] });
      qc.invalidateQueries({ queryKey: ["library-owned", id] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Unlocked! Enjoy the read.");
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Purchase failed";
      if (msg.includes("INSUFFICIENT_CREDITS")) toast.error("Not enough credits");
      else if (msg.includes("Not authenticated")) toast.error("Sign in to unlock");
      else toast.error(msg);
    },
  });

  const gid = useMemo(() => parseGutenbergId(book), [book]);
  // Gutenberg books render via embedded HTML reader; everything else is cached as PDF.
  // Anything that isn't Gutenberg HTML we try to resolve to a real PDF.
  const shouldCachePdf = !!book && !gid;
  const embedUrl = gid
    ? `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}-images.html`
    : null;
  const epubUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}.epub3.images` : null;
  const txtUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}.txt.utf-8` : null;
  const kindleUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}.kf8.images` : null;
  const detailsUrl = gid
    ? `https://www.gutenberg.org/ebooks/${gid}`
    : book?.read_url ?? null;
  const [cacheError, setCacheError] = useState<string | null>(null);

  // The moment a user owns a non-Gutenberg book, mirror to Cloud and open the reader.
  useEffect(() => {
    if (!book || !owned || !shouldCachePdf) return;
    if (cachedPdfUrl || cacheLoading) return;
    let cancelled = false;
    setCacheLoading(true);
    setCacheError(null);
    (async () => {
      try {
        const res = await fetch(`/api/public/hooks/cache-book-pdf?id=${book.id}`);
        const json = await res.json();
        if (cancelled) return;
        if (json?.ok && json.cached_url) {
          setCachedPdfUrl(json.cached_url);
          setReaderOpen(true);
        } else {
          setCacheError(json?.error ?? "could_not_prepare");
        }
      } catch (e) {
        setCacheError((e as Error).message);
      } finally {
        if (!cancelled) setCacheLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book, owned, shouldCachePdf, cachedPdfUrl, cacheLoading]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={() => router.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Link to="/books" className="text-xs text-muted-foreground hover:text-primary">Book Plug</Link>
        </div>

        {isLoading && (
          <p className="text-center text-muted-foreground py-12">
            <Loader2 className="w-5 h-5 inline animate-spin mr-1" /> Loading book…
          </p>
        )}

        {!isLoading && !book && (
          <div className="text-center py-16 text-muted-foreground bg-card border rounded-2xl">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Book not found.</p>
          </div>
        )}

        {book && (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-card">
            <div className="p-4 flex gap-4 items-start border-b">
              {book.cover_url && (
                <img src={book.cover_url} alt={book.title} className="w-20 h-28 object-cover rounded-lg shadow" />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold font-display leading-tight">{book.title}</h1>
                <p className="text-sm text-muted-foreground">{book.author}</p>
                <div className="flex gap-2 mt-2 flex-wrap text-xs">
                  <span className="capitalize px-2 py-0.5 rounded-full bg-muted">{book.category}</span>
                  {book.first_publish_year && (
                    <span className="px-2 py-0.5 rounded-full bg-muted">{book.first_publish_year}</span>
                  )}
                  <span className="inline-flex items-center gap-1 font-bold text-primary">
                    <Coins className="w-3 h-3" /> {book.price_credits}
                  </span>
                </div>
              </div>
            </div>

            {owned === false ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Unlock this book with <strong>{book.price_credits} credits</strong> to read or download it inside the app.
                </p>
                <Button onClick={() => buy.mutate()} disabled={buy.isPending}>
                  {buy.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Coins className="w-4 h-4 mr-1" />}
                  Unlock for {book.price_credits} credits
                </Button>
              </div>
            ) : owned ? (
              <>
                <div className="px-4 py-3 flex flex-wrap gap-2 border-b bg-muted/30">
                  {shouldCachePdf && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (cachedPdfUrl) setReaderOpen(true);
                      }}
                      disabled={!cachedPdfUrl}
                    >
                      {cacheLoading ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <BookOpen className="w-3.5 h-3.5 mr-1" />
                      )}
                      {cacheLoading ? "Preparing…" : "Open reader"}
                    </Button>
                  )}
                  {epubUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={epubUrl} download>
                        <Download className="w-3.5 h-3.5 mr-1" /> Download EPUB
                      </a>
                    </Button>
                  )}
                  {txtUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={txtUrl} download>
                        <Download className="w-3.5 h-3.5 mr-1" /> Plain Text
                      </a>
                    </Button>
                  )}
                  {kindleUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={kindleUrl} download>
                        <Download className="w-3.5 h-3.5 mr-1" /> Kindle
                      </a>
                    </Button>
                  )}
                  {shouldCachePdf && cachedPdfUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={cachedPdfUrl} download>
                        <Download className="w-3.5 h-3.5 mr-1" /> Download PDF
                      </a>
                    </Button>
                  )}
                  {detailsUrl && gid && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={detailsUrl} target="_blank" rel="noopener">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> All formats
                      </a>
                    </Button>
                  )}
                </div>
                {gid && embedUrl ? (
                  <div className="w-full bg-black" style={{ height: "75vh" }}>
                    <iframe
                      src={embedUrl}
                      title={book.title}
                      className="w-full h-full border-0"
                      allow="fullscreen"
                      allowFullScreen
                    />
                  </div>
                ) : shouldCachePdf ? (
                  <div className="p-8 text-center text-muted-foreground space-y-3">
                    {cacheLoading ? (
                      <>
                        <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
                        <p className="text-sm">Preparing your book in the cloud…</p>
                      </>
                    ) : cacheError ? (
                      <>
                        <p className="text-sm">We couldn't extract a downloadable PDF for this book.</p>
                        {detailsUrl && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={detailsUrl} target="_blank" rel="noopener">
                              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open source page
                            </a>
                          </Button>
                        )}
                      </>
                    ) : (
                      <p className="text-sm">Reader is ready. Tap <strong>Open reader</strong> above to start.</p>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No readable source available for this book.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 inline animate-spin" /> Checking access…
              </div>
            )}
          </div>
        )}
      </div>

      {readerOpen && cachedPdfUrl && book && (
        <PdfReader
          url={cachedPdfUrl}
          title={book.title}
          downloadName={book.title}
          onClose={() => {
            setReaderOpen(false);
            router.navigate({ to: "/books" });
          }}
        />
      )}
    </AppShell>
  );
}
