// Book library sync — single source: freebookcentre.net
// We scrape category index pages, extract per-book {title, description, author},
// store the freebookcentre.net detail page as source_url + read_url (linking back
// to the listing), and generate a deterministic cover when none is available.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://www.freebookcentre.net";
const UA = "StudentsPlug/1.0 (+library-sync)";

type LibraryRow = {
  openlibrary_key: string; // unique key — reuse field name from existing schema
  title: string;
  author: string;
  cover_url: string | null;
  category: "course" | "book" | "novel" | "poetry" | "comics";
  read_url: string;
  source_url: string;
  description: string | null;
  first_publish_year: number | null;
  price_credits: number;
};

const PRICE: Record<LibraryRow["category"], number> = {
  course: 20,
  book: 25,
  novel: 20,
  poetry: 10,
  comics: 15,
};

// Curated freebookcentre.net category pages → our internal category.
// Picked to give wide coverage of Book/Novel/Course searches.
const SOURCES: Array<{ path: string; label: string; category: LibraryRow["category"] }> = [
  { path: "/Fiction/Literature-and-Fiction.html", label: "Literature and Fiction", category: "novel" },
  { path: "/Cooking/Cooking-Food-Drink-Books.html", label: "Cooking", category: "book" },
  { path: "/Business/Business-and-Finance-Books.html", label: "Business and Finance", category: "book" },
  { path: "/Law/Law-Books.html", label: "Law", category: "course" },
  { path: "/Physics/Physics-Books-Online.html", label: "Physics", category: "course" },
  { path: "/Physics/Introductory-Physics-Books.html", label: "Introductory Physics", category: "course" },
  { path: "/SpecialCat/Free-Mathematics-Books-Download.html", label: "Mathematics", category: "course" },
  { path: "/Chemistry/Chemistry-Books-Online.html", label: "Chemistry", category: "course" },
  { path: "/Biology/Biology-Books-Online.html", label: "Biology", category: "course" },
  { path: "/Electronics/Engineering-Books-Online.html", label: "Engineering", category: "course" },
  { path: "/Mechanical/Mechanical-Engineering-Books.html", label: "Mechanical Engineering", category: "course" },
  { path: "/Electrical/Electrical-Engineering-Books.html", label: "Electrical Engineering", category: "course" },
  { path: "/Civil/Civil-Engineering-Books.html", label: "Civil Engineering", category: "course" },
  { path: "/CompuScience/compscCategory.html", label: "Computer Science", category: "course" },
  { path: "/Database/dbCategory.html", label: "Databases", category: "course" },
  { path: "/Networking/networkCategory.html", label: "Networking", category: "course" },
  { path: "/Web/webCategory.html", label: "Web", category: "course" },
  { path: "/Language/langCategory.html", label: "Programming Languages", category: "course" },
];

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Generate a deterministic, on-brand cover URL when none is available.
// Uses placehold.co (no API key, no quota) — colors derive from a hash of the title.
const PALETTE = [
  ["4f46e5", "ffffff"],
  ["0f766e", "ffffff"],
  ["b91c1c", "ffffff"],
  ["c2410c", "ffffff"],
  ["7c2d12", "ffffff"],
  ["1e3a8a", "ffffff"],
  ["0e7490", "ffffff"],
  ["6d28d9", "ffffff"],
  ["be185d", "ffffff"],
  ["166534", "ffffff"],
];
function fallbackCover(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  const [bg, fg] = PALETTE[h % PALETTE.length];
  const words = title.split(/\s+/).slice(0, 4).join("\n");
  return `https://placehold.co/400x600/${bg}/${fg}/png?text=${encodeURIComponent(words)}&font=raleway`;
}

type ParsedBook = {
  detailHref: string;
  title: string;
  description: string | null;
  author: string | null;
};

function parseCategoryPage(html: string): ParsedBook[] {
  const books: ParsedBook[] = [];
  // Each book is wrapped in itemtype="http://schema.org/Book" itemscope.
  // Use a non-greedy block extraction.
  const blockRe = /itemtype="https?:\/\/schema\.org\/Book"[\s\S]*?(?=itemtype="https?:\/\/schema\.org\/Book"|<footer|<\/body>)/g;
  const blocks = html.match(blockRe) ?? [];
  for (const block of blocks) {
    const nameMatch = block.match(/itemprop="name"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    if (!nameMatch) continue;
    const detailHref = nameMatch[1];
    const title = decode(nameMatch[2]);
    if (!title || title.length < 3) continue;
    const descMatch = block.match(/itemprop="description"[^>]*>([\s\S]*?)<\/span>/);
    const description = descMatch ? decode(descMatch[1].replace(/<[^>]+>/g, " ")).slice(0, 800) : null;
    const authorMatch = block.match(/itemprop="author"[^>]*>([\s\S]*?)<\/span>/);
    const author = authorMatch ? decode(authorMatch[1].replace(/<[^>]+>/g, " ")).slice(0, 200) : null;
    books.push({ detailHref, title, description, author });
  }
  return books;
}

function resolveUrl(catPath: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  // Category pages live at /Section/Page.html; detail links use ../section/Page.html
  const base = new URL(BASE + catPath);
  return new URL(href, base).toString();
}

async function fetchCategory(src: (typeof SOURCES)[number]): Promise<LibraryRow[]> {
  const res = await fetch(BASE + src.path, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const html = await res.text();
  const parsed = parseCategoryPage(html);
  return parsed.map((b): LibraryRow => {
    const sourceUrl = resolveUrl(src.path, b.detailHref);
    const slug = b.detailHref.split("/").pop()?.replace(/\.html$/i, "") ?? b.title;
    const author = b.author && b.author.toUpperCase() !== "NA" ? b.author : "Free Book Centre";
    return {
      openlibrary_key: `fbc-${src.category}-${slug}`.slice(0, 200),
      title: b.title.slice(0, 280),
      author: author.slice(0, 200),
      cover_url: fallbackCover(b.title),
      category: src.category,
      read_url: sourceUrl,
      source_url: sourceUrl,
      description: b.description,
      first_publish_year: null,
      price_credits: PRICE[src.category],
    };
  });
}

async function upsertRows(label: string, rows: LibraryRow[]) {
  if (!rows.length) return { source: label, inserted: 0 };
  const { error, count } = await supabaseAdmin
    .from("library_books")
    .upsert(rows, { onConflict: "openlibrary_key", ignoreDuplicates: false, count: "exact" });
  if (error) throw new Error(`upsert ${label}: ${error.message}`);
  return { source: label, inserted: count ?? rows.length };
}

async function runSync() {
  const results: Array<{ source: string; inserted?: number; error?: string }> = [];
  // Backfill missing covers on existing rows that came from earlier syncs.
  for (const src of SOURCES) {
    try {
      const rows = await fetchCategory(src);
      results.push(await upsertRows(`freebookcentre:${src.label}`, rows));
    } catch (e) {
      results.push({ source: `freebookcentre:${src.label}`, error: (e as Error).message });
    }
  }
  // Patch any row that still has no cover with a generated one.
  const { data: noCover } = await supabaseAdmin
    .from("library_books")
    .select("id,title")
    .or("cover_url.is.null,cover_url.eq.")
    .limit(500);
  if (noCover && noCover.length) {
    for (const b of noCover) {
      await supabaseAdmin
        .from("library_books")
        .update({ cover_url: fallbackCover(b.title) })
        .eq("id", b.id);
    }
    results.push({ source: "cover-backfill", inserted: noCover.length });
  }
  return results;
}

function renderSyncHtml(title: string, results: Awaited<ReturnType<typeof runSync>>) {
  const rows = results
    .map(
      (r) =>
        `<tr><td>${r.source}</td><td>${r.inserted ?? 0}</td><td>${r.error ? `⚠️ ${r.error}` : "OK"}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui;margin:0;padding:24px;background:#f8fafc;color:#0f172a}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}td,th{padding:12px;border-bottom:1px solid #e2e8f0;text-align:left}</style></head><body><h1>${title}</h1><table><thead><tr><th>Source</th><th>Rows</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

async function syncResponse(request: Request) {
  const results = await runSync();
  const wantsJson =
    new URL(request.url).searchParams.get("format") === "json" ||
    !request.headers.get("accept")?.includes("text/html");
  if (wantsJson) return Response.json({ ok: true, results });
  return new Response(renderSyncHtml("Book library sync (freebookcentre.net)", results), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/public/hooks/sync-library-books")({
  server: {
    handlers: {
      GET: ({ request }) => syncResponse(request),
      POST: async () => Response.json({ ok: true, results: await runSync() }),
    },
  },
});
