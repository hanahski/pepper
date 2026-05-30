import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PARSE_ENDPOINT =
  "https://api.parse.bot/scraper/3a337ff6-0b75-4299-bf58-78ab3fd4c22a/check_post_utme_result";

const inputSchema = z.object({
  jambRegNumber: z
    .string()
    .trim()
    .min(6, "JAMB reg number too short")
    .max(20, "JAMB reg number too long")
    .regex(/^[A-Za-z0-9]+$/, "Only letters and numbers allowed"),
});

/**
 * Verify EBSU student via parse.bot scraper for the EBSU post-UTME result page.
 * Sets profiles.is_verified = true when found.
 */
export const verifyEbsuStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const apiKey = process.env.PARSE_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Verification service not configured" as const };
    }

    const jamb = data.jambRegNumber.toUpperCase();
    const url = `${PARSE_ENDPOINT}?jamb_reg_number=${encodeURIComponent(jamb)}`;

    let parsed: any = null;
    let httpOk = false;
    let httpStatus = 0;
    try {
      const r = await fetch(url, {
        method: "GET",
        headers: { "X-API-Key": apiKey.trim(), Accept: "application/json" },
      });
      httpOk = r.ok;
      httpStatus = r.status;
      const text = await r.text();
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
    } catch (e: any) {
      parsed = { error: String(e?.message ?? e) };
    }

    // A bad/expired parse.bot key is a configuration problem, not a "not found".
    if (httpStatus === 401 || httpStatus === 403) {
      console.error("parse.bot auth rejected:", parsed);
      return {
        ok: false as const,
        error:
          "Verification service is misconfigured (invalid API key). Please contact the admin.",
      };
    }

    // parse.bot returns: { status: "success", data: { found: true/false, message: "..." } }
    const found = !!(
      parsed?.data?.found === true ||
      parsed?.found === true ||
      parsed?.data?.verified === true ||
      parsed?.verified === true ||
      parsed?.data?.status === "found"
    );

    // Log the attempt regardless of outcome
    await supabaseAdmin.from("student_verifications").insert({
      user_id: userId,
      jamb_reg_number: jamb,
      verified: found,
      response: parsed,
    });

    if (!found) {
      const msg =
        parsed?.data?.message ||
        parsed?.message ||
        (httpOk
          ? "We couldn't find that JAMB number on the EBSU portal. Double-check and try again."
          : "Could not reach the EBSU portal — please try again in a moment.");
      return { ok: false as const, error: msg };
    }

    // Mark profile verified — uses admin client (bypasses RLS) since is_verified is server-controlled.
    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({ is_verified: true } as any)
      .eq("id", userId);
    if (updErr) {
      return { ok: false as const, error: updErr.message };
    }

    return { ok: true as const, jambRegNumber: jamb };
  });
