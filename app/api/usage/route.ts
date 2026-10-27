import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try { supabase = await createClient(); }
  catch { return Response.json({ error: "Supabase is not configured." }, { status: 503 }); }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: subscription } = await supabase.from("subscriptions")
    .select("plan,status").eq("user_id", user.id).in("status", ["active", "trialing"]).maybeSingle();
  const activePlan = subscription?.plan || "free";
  const limits: Record<string, { requests: number; tokens: number }> = {
    free: { requests: 50, tokens: 100000 },
    pro: { requests: 1000, tokens: 2000000 },
    team: { requests: 5000, tokens: 10000000 },
    enterprise: { requests: 20000, tokens: 50000000 },
  };
  const plan = limits[activePlan] ? activePlan : "free";
  const { data: rows, error } = await supabase.from("usage_records")
    .select("input_tokens,output_tokens,request_status")
    .eq("user_id", user.id).gte("created_at", monthStart.toISOString())
    .in("request_status", ["reserved", "completed"]);
  if (error) return Response.json({ error: "Could not load usage." }, { status: 500 });

  const requestsUsed = rows?.length || 0;
  const tokensUsed = (rows || []).reduce((sum, row) => sum + (row.input_tokens || 0) + (row.output_tokens || 0), 0);
  const limit = limits[plan];
  return Response.json({
    plan, periodStart: monthStart.toISOString(), requestsUsed, requestLimit: limit.requests,
    tokensUsed, tokenLimit: limit.tokens,
    requestsRemaining: Math.max(0, limit.requests - requestsUsed),
    tokensRemaining: Math.max(0, limit.tokens - tokensUsed),
  });
}
