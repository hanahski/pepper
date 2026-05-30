// Book library sync — single source: freebookcentre.net
// We auto-discover EVERY category page linked from the freebookcentre.net home
// page (≈380 leaf category pages spanning the whole catalog), scrape each one,
// extract per-book {title, description, author}, store the freebookcentre.net
// detail page as source_url + read_url, and generate a deterministic cover when
// none is available.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://www.freebookcentre.net";
const UA = "StudentsPlug/1.0 (+library-sync)";

type Category = "course" | "book" | "novel" | "poetry" | "comics";

type LibraryRow = {
  openlibrary_key: string; // unique key — reuse field name from existing schema
  title: string;
  author: string;
  cover_url: string | null;
  category: Category;
  read_url: string;
  source_url: string;
  description: string | null;
  first_publish_year: number | null;
  price_credits: number;
};

const PRICE: Record<Category, number> = {
  course: 20,
  book: 25,
  novel: 20,
  poetry: 10,
  comics: 15,
};

// Map a freebookcentre top-level section (the first path segment) to our
// internal category. Everything academic/technical defaults to "course".
function sectionCategory(section: string): Category {
  const s = section.toLowerCase();
  if (s === "fiction") return "novel";
  if (s === "cooking" || s === "misc" || s === "business" || s === "hardwarebus") return "book";
  if (s === "law") return "course";
  return "course";
}

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
  const blockRe =
    /itemtype="https?:\/\/schema\.org\/Book"[\s\S]*?(?=itemtype="https?:\/\/schema\.org\/Book"|<footer|<\/body>)/g;
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
  const base = new URL(BASE + catPath);
  return new URL(href, base).toString();
}

// Discover every category leaf page linked from the home page.
async function discoverCategoryPaths(): Promise<string[]> {
  const res = await fetch(BASE + "/", { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`home ${res.status}`);
  const html = await res.text();
  const set = new Set<string>();
  const re = /href="(\/[A-Za-z0-9]+\/[^"]+\.html)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[1]);
  return Array.from(set);
}

async function fetchCategory(path: string): Promise<LibraryRow[]> {
  const res = await fetch(BASE + path, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const html = await res.text();
  const parsed = parseCategoryPage(html);
  const section = path.split("/")[1] ?? "Misc";
  const category = sectionCategory(section);
  return parsed.map((b): LibraryRow => {
    const sourceUrl = resolveUrl(path, b.detailHref);
    const slug = b.detailHref.split("/").pop()?.replace(/\.html$/i, "") ?? b.title;
    const author = b.author && b.author.toUpperCase() !== "NA" ? b.author : "Free Book Centre";
    return {
      openlibrary_key: `fbc-${category}-${slug}`.slice(0, 200),
      title: b.title.slice(0, 280),
      author: author.slice(0, 200),
      cover_url: fallbackCover(b.title),
      category,
      read_url: sourceUrl,
      source_url: sourceUrl,
      description: b.description,
      first_publish_year: null,
      price_credits: PRICE[category],
    };
  });
}

async function upsertRows(rows: LibraryRow[]): Promise<number> {
  if (!rows.length) return 0;
  // De-dup within the batch by key to avoid "cannot affect row a second time".
  const map = new Map<string, LibraryRow>();
  for (const r of rows) map.set(r.openlibrary_key, r);
  const unique = Array.from(map.values());
  const { error, count } = await supabaseAdmin
    .from("library_books")
    .upsert(unique, { onConflict: "openlibrary_key", ignoreDuplicates: false, count: "exact" });
  if (error) throw new Error(error.message);
  return count ?? unique.length;
}

// Run tasks with limited concurrency.
async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

async function runSync(opts?: { max?: number }) {
  const paths = await discoverCategoryPaths();
  const limited = opts?.max ? paths.slice(0, opts.max) : paths;

  let pagesOk = 0;
  let pagesFailed = 0;
  let totalBooks = 0;
  const errors: string[] = [];

  // Scrape every category page (bounded concurrency), then upsert in chunks.
  const allRows: LibraryRow[] = [];
  await pool(limited, 10, async (path) => {
    try {
      const rows = await fetchCategory(path);
      pagesOk++;
      totalBooks += rows.length;
      allRows.push(...rows);
    } catch (e) {
      pagesFailed++;
      if (errors.length < 20) errors.push(`${path}: ${(e as Error).message}`);
    }
  });

  // Upsert in chunks of 500 to stay within payload limits.
  let inserted = 0;
  for (let j = 0; j < allRows.length; j += 500) {
    try {
      inserted += await upsertRows(allRows.slice(j, j + 500));
    } catch (e) {
      if (errors.length < 30) errors.push(`upsert: ${(e as Error).message}`);
    }
  }

  return {
    categoriesDiscovered: paths.length,
    categoriesScraped: limited.length,
    pagesOk,
    pagesFailed,
    booksFound: totalBooks,
    rowsUpserted: inserted,
    errors,
  };
}

function renderSyncHtml(title: string, r: Awaited<ReturnType<typeof runSync>>) {
  const rows = [
    ["Categories discovered", r.categoriesDiscovered],
    ["Categories scraped", r.categoriesScraped],
    ["Pages OK", r.pagesOk],
    ["Pages failed", r.pagesFailed],
    ["Books found", r.booksFound],
    ["Rows upserted", r.rowsUpserted],
  ]
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");
  const errs = r.errors.length
    ? `<h2>Errors</h2><ul>${r.errors.map((e) => `<li>${e}</li>`).join("")}</ul>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui;margin:0;padding:24px;background:#f8fafc;color:#0f172a}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}td,th{padding:12px;border-bottom:1px solid #e2e8f0;text-align:left}</style></head><body><h1>${title}</h1><table><tbody>${rows}</tbody></table>${errs}</body></html>`;
}

async function syncResponse(request: Request) {
  const url = new URL(request.url);
  const maxParam = url.searchParams.get("max");
  const max = maxParam ? Math.max(1, parseInt(maxParam, 10) || 0) : undefined;
  const results = await runSync({ max });
  const wantsJson =
    url.searchParams.get("format") === "json" ||
    !request.headers.get("accept")?.includes("text/html");
  if (wantsJson) return Response.json({ ok: true, results });
  return new Response(renderSyncHtml("Book library sync (freebookcentre.net — full catalog)", results), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/public/hooks/sync-library-books")({
  server: {
    handlers: {
      GET: ({ request }) => syncResponse(request),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const maxParam = url.searchParams.get("max");
        const max = maxParam ? Math.max(1, parseInt(maxParam, 10) || 0) : undefined;
        return Response.json({ ok: true, results: await runSync({ max }) });
      },
    },
  },
});
