import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try { supabase = await createClient(); } catch { return Response.json({ error: "Supabase is not configured." }, { status: 503 }); }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await supabase.from("conversations")
    .select("id,title,created_at,updated_at")
    .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Could not load conversation history." }, { status: 500 });
  return Response.json({ conversations: data || [] });
}

const createSchema = z.object({ title: z.string().trim().min(1).max(100).optional() });
export async function POST(request: Request) {
  let supabase;
  try { supabase = await createClient(); } catch { return Response.json({ error: "Supabase is not configured." }, { status: 503 }); }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid conversation title." }, { status: 400 });
  const { data, error } = await supabase.from("conversations")
    .insert({ user_id: user.id, title: parsed.data.title || "New chat" })
    .select("id,title,created_at,updated_at").single();
  if (error || !data) return Response.json({ error: "Could not create conversation." }, { status: 500 });
  return Response.json({ conversation: data }, { status: 201 });
}
