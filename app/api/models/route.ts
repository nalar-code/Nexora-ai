import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try { supabase = await createClient(); }
  catch { return Response.json({ error: "Supabase is not configured." }, { status: 503 }); }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const configured = (process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini")
    .split(",").map(value => value.trim()).filter(Boolean);
  const models = [...new Set(configured)].slice(0, 30);
  return Response.json({ models, defaultModel: models[0] }, { headers: { "Cache-Control": "no-store" } });
}
