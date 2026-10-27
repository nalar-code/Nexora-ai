import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  model: z.string().trim().min(1).max(160).optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(20000),
  })).min(1).max(40),
});

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function configuredModels(): string[] {
  const models = (process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini")
    .split(",").map(value => value.trim()).filter(Boolean);
  return [...new Set(models)].slice(0, 30);
}

export async function POST(request: Request) {
  let supabase;
  try { supabase = await createClient(); }
  catch { return Response.json({ error: "Supabase is not configured. Set the project URL and anon key." }, { status: 503 }); }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sign in to use the AI chat." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid message payload." }, { status: 400 });
  if (!process.env.OPENROUTER_API_KEY) return Response.json({ error: "AI provider is not configured. Add OPENROUTER_API_KEY to server environment variables." }, { status: 503 });

  const models = configuredModels();
  const requestedModel = parsed.data.model;
  const model = requestedModel && models.includes(requestedModel) ? requestedModel : models[0];
  if (requestedModel && !models.includes(requestedModel)) {
    return Response.json({ error: "That model is not enabled. Choose a model configured by the server." }, { status: 400 });
  }

  const lastUserMessage = [...parsed.data.messages].reverse().find(m => m.role === "user");
  if (!lastUserMessage) return Response.json({ error: "A user message is required." }, { status: 400 });
  const estimatedInputTokens = estimateTokens(parsed.data.messages.map(m => m.content).join("\n"));

  const { data: reservation, error: reservationError } = await supabase.rpc("reserve_ai_request", {
    p_model: model, p_input_tokens: estimatedInputTokens,
  });
  if (reservationError) {
    console.error("Usage reservation failed:", reservationError);
    return Response.json({ error: "Could not verify usage quota. Apply the Phase 3 SQL migration." }, { status: 503 });
  }
  if (!reservation?.allowed) {
    const reason = reservation?.reason === "token_limit" ? "token_limit" : "request_limit";
    return Response.json({
      error: reason === "token_limit" ? "Monthly token allowance reached. Upgrade your plan or try again next month." : "Monthly message limit reached. Upgrade your plan or try again next month.",
      code: "QUOTA_EXCEEDED", quota: reservation,
    }, { status: 429 });
  }
  const usageId = reservation.usage_id as string;
  const finalize = async (outputTokens: number, status: "completed" | "failed", inputTokens = estimatedInputTokens) => {
    const { error } = await supabase.rpc("finalize_ai_usage", {
      p_usage_id: usageId, p_output_tokens: outputTokens, p_status: status, p_input_tokens: inputTokens,
    });
    if (error) console.error("Usage finalization failed:", error);
  };

  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const { data: existing, error } = await supabase.from("conversations").select("id")
      .eq("id", conversationId).eq("user_id", user.id).maybeSingle();
    if (error || !existing) {
      await finalize(0, "failed");
      return Response.json({ error: "Conversation not found or access denied." }, { status: error ? 500 : 404 });
    }
  } else {
    const title = lastUserMessage.content.replace(/\s+/g, " ").slice(0, 72) || "New chat";
    const { data: created, error } = await supabase.from("conversations").insert({ user_id: user.id, title }).select("id").single();
    if (error || !created) {
      await finalize(0, "failed");
      return Response.json({ error: "Could not create conversation." }, { status: 500 });
    }
    conversationId = created.id;
  }

  const { error: saveUserError } = await supabase.from("messages").insert({
    conversation_id: conversationId, user_id: user.id, role: "user", content: lastUserMessage.content, model,
  });
  if (saveUserError) {
    await finalize(0, "failed");
    return Response.json({ error: "Could not save your message." }, { status: 500 });
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        ...(process.env.APP_ORIGIN ? { "HTTP-Referer": process.env.APP_ORIGIN } : {}),
        "X-OpenRouter-Title": "Nexora AI",
      },
      body: JSON.stringify({
        model,
        messages: parsed.data.messages.map(message => ({ role: message.role, content: message.content })),
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: Math.min(4096, Math.max(1, Number(process.env.OPENROUTER_MAX_OUTPUT_TOKENS || 2048))),
      }),
      signal: request.signal,
      cache: "no-store",
    });
  } catch (error) {
    console.error("OpenRouter request failed:", error);
    await finalize(0, "failed");
    return Response.json({ error: "OpenRouter could not start a response. Check your model and account credits, then retry." }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    const status = upstream.status;
    const providerMessage = await upstream.text().catch(() => "");
    console.error("OpenRouter returned an error:", status, providerMessage.slice(0, 1200));
    await finalize(0, "failed");
    return Response.json({ error: status === 401 || status === 403 ? "OpenRouter rejected the API key or access to this model." : status === 402 ? "OpenRouter account has insufficient credits." : status === 429 ? "OpenRouter rate limit reached. Please retry shortly." : "OpenRouter returned an error. Check the configured model and try again." }, { status: status === 429 ? 429 : 502 });
  }

  const encoder = new TextEncoder();
  const streamResponse = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let buffer = "";
      let streamFailed = false;
      const decoder = new TextDecoder();
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith(":" ) || !line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            let event: any;
            try { event = JSON.parse(data); } catch { continue; }
            if (event.error) { streamFailed = true; throw new Error("OpenRouter stream reported an error"); }
            if (typeof event.usage?.prompt_tokens === "number") inputTokens = event.usage.prompt_tokens;
            if (typeof event.usage?.completion_tokens === "number") outputTokens = event.usage.completion_tokens;
            const piece = event.choices?.[0]?.delta?.content;
            if (typeof piece === "string" && piece) {
              answer += piece;
              controller.enqueue(encoder.encode(piece));
            } else if (Array.isArray(piece)) {
              const text = piece.map((part: any) => typeof part?.text === "string" ? part.text : "").join("");
              if (text) { answer += text; controller.enqueue(encoder.encode(text)); }
            }
          }
        }
        buffer += decoder.decode();
        if (buffer.trim()) {
          const finalLine = buffer.trim();
          if (finalLine.startsWith("data:")) {
            const data = finalLine.slice(5).trim();
            if (data !== "[DONE]") {
              try {
                const event = JSON.parse(data);
                if (typeof event.usage?.prompt_tokens === "number") inputTokens = event.usage.prompt_tokens;
                if (typeof event.usage?.completion_tokens === "number") outputTokens = event.usage.completion_tokens;
                const piece = event.choices?.[0]?.delta?.content;
                if (typeof piece === "string" && piece) { answer += piece; controller.enqueue(encoder.encode(piece)); }
              } catch { /* Ignore incomplete trailing SSE frames. */ }
            }
          }
        }
        if (answer.trim()) {
          const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: answer, model });
          if (error) console.error("Could not persist assistant message:", error);
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", user.id);
        }
        await finalize(outputTokens || estimateTokens(answer), answer.trim() && !streamFailed ? "completed" : "failed", inputTokens || estimatedInputTokens);
        controller.close();
      } catch (error) {
        console.error("OpenRouter stream failed:", error);
        await finalize(outputTokens || estimateTokens(answer), "failed", inputTokens || estimatedInputTokens);
        try { controller.error(new Error("The AI response stream failed.")); } catch {}
      } finally { reader.releaseLock(); }
    },
    async cancel() {
      try { await upstream.body?.cancel(); } catch { /* stream may already be closed */ }
    },
  });
  return new Response(streamResponse, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff", "X-Conversation-Id": conversationId!,
      "X-Model": model, "X-Plan": String(reservation.plan || "free"),
      "X-Requests-Remaining": String(Math.max(0, Number(reservation.request_limit) - Number(reservation.requests_used))),
    },
  });
}
