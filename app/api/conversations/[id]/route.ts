import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  let supabase;
  try { supabase = await createClient(); } catch { return Response.json({ error: "Supabase is not configured." }, { status: 503 }); }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { data: conversation, error } = await supabase.from("conversations")
    .select("id,title,created_at,updated_at").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return Response.json({ error: "Could not load conversation." }, { status: 500 });
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
  const { data: messages, error: messagesError } = await supabase.from("messages")
    .select("id,role,content,model,created_at").eq("conversation_id", id).eq("user_id", user.id).order("created_at", { ascending: true }).limit(500);
  if (messagesError) return Response.json({ error: "Could not load messages." }, { status: 500 });
  return Response.json({ conversation, messages: messages || [] });
}
