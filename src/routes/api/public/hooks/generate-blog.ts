import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TOPICS = [
  "Nigerian government education policy update",
  "ASUU and federal university funding news",
  "TETFund and university infrastructure",
  "Student loan scheme (NELFUND) and finance",
  "Tuition fee hikes across federal universities",
  "Scholarships and bursaries for Nigerian students",
  "Forex, naira and the cost of being a student",
  "Federal budget allocation to tertiary education",
  "JAMB, NYSC, and admission policy trends",
  "Cost of living for university students in Nigeria",
  "Side hustles and student entrepreneurship",
  "Crypto and digital finance for Gen Z students",
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

async function generateImage(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.LOVABLE_API_KEY!;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: `Photorealistic editorial photograph for a Nigerian university news story. Documentary photojournalism style, natural lighting, shallow depth of field, 50mm lens, true-to-life skin tones, real Nigerian campus / Lagos / Abuja setting where appropriate. Authentic, candid, magazine quality — NOT cartoon, NOT illustration, NOT 3D render, NOT anime. No text, no letters, no logos, no watermarks. Subject: ${prompt}` }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      console.error("image gen failed:", res.status, await res.text());
      return null;
    }
    const j = await res.json();
    const b64 = j.data?.[0]?.b64_json;
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch (e) {
    console.error("image gen error:", e);
    return null;
  }
}

async function generateOne(topic: string) {
  const apiKey = process.env.LOVABLE_API_KEY!;
  const prompt = `Write a fresh, trending blog post for Nigerian university students about: "${topic}".
Tone: engaging, current, factual, student-friendly. ~400 words.
Return STRICT JSON only (no markdown fences) with keys:
{"title": string (max 90 chars, punchy), "excerpt": string (max 160 chars), "body": string (markdown, 350-500 words), "emoji": string (one emoji), "image_prompt": string (short visual description, no text/letters)}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a sharp Nigerian campus journalist. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const raw = j.choices?.[0]?.message?.content ?? "";
  const clean = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean) as { title: string; excerpt: string; body: string; emoji?: string; image_prompt?: string };

  const baseSlug = slugify(parsed.title);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  // Generate hero image (best effort)
  let hero_image_url: string | null = null;
  const imgBuf = await generateImage(parsed.image_prompt ?? parsed.title);
  if (imgBuf) {
    const path = `${slug}.png`;
    const { error: upErr } = await supabaseAdmin.storage.from("blog-images").upload(path, imgBuf, {
      contentType: "image/png",
      upsert: true,
    });
    if (!upErr) {
      const { data: pub } = supabaseAdmin.storage.from("blog-images").getPublicUrl(path);
      hero_image_url = pub.publicUrl;
    } else {
      console.error("upload failed:", upErr);
    }
  }

  const { error } = await supabaseAdmin.from("blogs").insert({
    slug,
    title: parsed.title,
    excerpt: parsed.excerpt,
    body: parsed.body,
    topic,
    hero_emoji: parsed.emoji ?? "📰",
    hero_image_url,
  });
  if (error) throw error;
  return { slug, title: parsed.title, hero_image_url };
}

export const Route = createFileRoute("/api/public/hooks/generate-blog")({
  server: {
    handlers: {
      POST: async () => {
        try {
          // Pick a random topic
          const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
          const result = await generateOne(topic);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("generate-blog error:", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => new Response("ok"),
    },
  },
});
