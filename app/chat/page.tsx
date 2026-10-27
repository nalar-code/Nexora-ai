"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { ArrowUp, Bot, Check, ChevronDown, Copy, FileText, Menu, MessageSquare, Plus, Search, Sparkles, Square, X } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; updated_at: string };
type Usage = { plan: string; requestsUsed: number; requestLimit: number; tokensUsed: number; tokenLimit: number; requestsRemaining: number; tokensRemaining: number };
const starters = [
  { icon: FileText, title: "Write something", prompt: "Help me write a clear, engaging introduction for a new project." },
  { icon: Bot, title: "Generate code", prompt: "Show me a simple TypeScript function and explain how it works." },
  { icon: Search, title: "Research a topic", prompt: "Explain the key ideas behind building a reliable SaaS product." },
  { icon: Sparkles, title: "Brainstorm ideas", prompt: "Give me five creative ideas for improving productivity with AI." },
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [models, setModels] = useState<string[]>(["openai/gpt-4o-mini"]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        const supabase = createSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!alive) return;
        if (!user) { router.replace("/login"); return; }
        setAuthReady(true);
        await Promise.all([loadConversations(), loadUsage(), loadModels()]);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not initialize workspace.");
      }
    }
    void init();
    return () => { alive = false; };
  }, [router]);

  async function loadModels() {
    const response = await fetch("/api/models", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.models) && data.models.length) {
      setModels(data.models);
      setModel((current) => data.models.includes(current) ? current : (data.defaultModel || data.models[0]));
    }
  }

  async function loadUsage() {
    const response = await fetch("/api/usage", { cache: "no-store" });
    if (response.status === 401) { router.replace("/login"); return; }
    if (!response.ok) return;
    setUsage(await response.json());
  }

  async function loadConversations() {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    if (response.status === 401) { router.replace("/login"); return; }
    if (!response.ok) return;
    const data = await response.json();
    setConversations(data.conversations || []);
  }

  async function openConversation(id: string) {
    setError("");
    const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    if (!response.ok) { setError("Could not open this conversation."); return; }
    const data = await response.json();
    setConversationId(id);
    setMessages((data.messages || []).map((m: {role: "user" | "assistant"; content: string}) => ({role:m.role,content:m.content})));
    setMobileSidebar(false);
  }

  async function startNewChat() {
    setConversationId(null); setMessages([]); setError(""); setMobileSidebar(false);
  }

  async function logout() {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login"); router.refresh();
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function sendMessage(text = input) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput(""); setBusy(true); setError("");
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, model, conversationId: conversationId || undefined }), signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not get a response. Check your server configuration.");
      }
      const returnedConversationId = response.headers.get("X-Conversation-Id");
      if (returnedConversationId) setConversationId(returnedConversationId);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming is not available in this browser.");
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: answer }]);
      }
      answer += decoder.decode();
      setMessages([...next, { role: "assistant", content: answer }]);
      await Promise.all([loadConversations(), loadUsage(), loadModels()]);
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setError(e.message);
    } finally { setBusy(false); abortRef.current = null; }
  }

  function stop() { abortRef.current?.abort(); setBusy(false); }
  async function copyText(text: string, index: number) {
    await navigator.clipboard.writeText(text); setCopied(index); setTimeout(() => setCopied(null), 1500);
  }
  function submit(e: FormEvent) { e.preventDefault(); void sendMessage(); }

  if (!authReady) return <main className="auth-page"><section className="auth-card"><div className="brand"><span className="brand-mark"><Sparkles size={18}/></span>Nexora <b>AI</b></div><p>Checking your secure session…</p><Link className="text-link" href="/login">Go to login <ArrowUp size={14}/></Link></section></main>;

  return <div className="chat-shell">
    <aside className={`chat-sidebar ${mobileSidebar ? "sidebar-open" : ""}`}>
      <div className="sidebar-head"><Link className="brand" href="/"><span className="brand-mark"><Sparkles size={17}/></span>Nexora <b>AI</b></Link><button className="icon-button mobile-close" onClick={() => setMobileSidebar(false)} aria-label="Close menu"><X size={18}/></button></div>
      <button className="new-chat" onClick={() => { void startNewChat(); }}><Plus size={17}/> New chat <span>⌘ K</span></button>
      <div className="side-search"><Search size={15}/><span>Search conversations</span></div>
      <div className="side-label">WORKSPACE</div>
      <button className="side-item active"><MessageSquare size={16}/> Chat</button>
      <div className="usage-card"><div><span>MONTHLY USAGE</span><b>{usage ? `${usage.requestsUsed} / ${usage.requestLimit}` : "Loading…"}</b></div><div className="usage-track"><i style={{ width: `${usage ? Math.min(100, usage.requestsUsed / Math.max(1, usage.requestLimit) * 100) : 0}%` }}/></div><small>{usage ? `${usage.requestsRemaining} requests remaining · ${usage.plan.toUpperCase()}` : "Checking quota"}</small></div><div className="side-label history-label">RECENT CHATS</div><div className="history-list">{conversations.map(c => <button className={`side-item history-item ${conversationId === c.id ? "active" : ""}`} key={c.id} title={c.title} onClick={() => void openConversation(c.id)}><MessageSquare size={15}/><span>{c.title}</span></button>)}</div>
      <button className="side-item" onClick={() => setError("Document analysis is a planned feature and is not enabled in this MVP.")}><FileText size={16}/> Documents <span className="coming">SOON</span></button>
      <div className="sidebar-bottom"><div className="usage-card"><div className="usage-top"><span>Free workspace</span><span>Preview</span></div><div className="usage-bar"><i/></div><p>Usage limits must be configured for production.</p><button onClick={() => setError("Billing is not connected. Configure a payment provider and verified webhooks before enabling upgrades.")}>Explore plans <ArrowUp size={14}/></button></div><Link href="/" className="profile-row"><span className="profile-avatar">N</span><span><b>Signed-in workspace</b><small>Private account</small></span><button className="logout-button" onClick={(e) => { e.preventDefault(); void logout(); }} aria-label="Sign out">↗</button></Link></div>
    </aside>
    {mobileSidebar && <button className="sidebar-scrim" onClick={() => setMobileSidebar(false)} aria-label="Close sidebar"/>}
    <section className="chat-main">
      <header className="chat-topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileSidebar(true)} aria-label="Open menu"><Menu size={19}/></button><span className="breadcrumb">Workspace <span>/</span> <b>New chat</b></span></div><div className="model-picker"><button className="model-select" onClick={() => setModelMenuOpen(open => !open)} aria-expanded={modelMenuOpen}><span className="model-dot"/>{model}<ChevronDown size={14}/></button>{modelMenuOpen && <div className="model-menu" role="listbox" aria-label="Choose AI model">{models.map(option => <button type="button" key={option} className={option === model ? "selected" : ""} onClick={() => { setModel(option); setModelMenuOpen(false); }}>{option}</button>)}</div>}</div></header>
      <div className={`conversation ${messages.length ? "has-messages" : ""}`}>
        {messages.length === 0 ? <div className="welcome">
          <div className="welcome-mark"><Sparkles size={29}/></div><div className="eyebrow">WELCOME TO NEXORA</div><h1>What would you like<br/><span>to create today?</span></h1><p>Your AI workspace for ideas, questions, and getting things done.</p>
          <div className="starter-grid">{starters.map(({icon: Icon,title,prompt})=><button key={title} className="starter-card" onClick={() => void sendMessage(prompt)}><span><Icon size={18}/></span><b>{title}</b><small>{prompt}</small></button>)}</div>
        </div> : <div className="message-list">{messages.map((m,i)=><div className={`message-row ${m.role}`} key={i}><div className={`message-avatar ${m.role}`}>{m.role === "assistant" ? <Sparkles size={16}/> : "Y"}</div><div className="message-content"><div className="message-label">{m.role === "assistant" ? "Nexora AI" : "You"}</div><div className="message-text">{m.content || (busy && i === messages.length - 1 ? <span className="typing"><i/><i/><i/></span> : "")}</div>{m.role === "assistant" && m.content && <button className="copy-button" onClick={() => void copyText(m.content,i)}>{copied === i ? <Check size={13}/> : <Copy size={13}/>} {copied === i ? "Copied" : "Copy"}</button>}</div></div>)}<div ref={endRef}/></div>}
      </div>
      <div className="composer-wrap"><form className="composer" onSubmit={submit}><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder="Message Nexora AI…" rows={1} aria-label="Message Nexora AI"/><div className="composer-footer"><span><Sparkles size={13}/> AI can make mistakes. Review important information.</span>{busy ? <button type="button" className="send-button stop-button" onClick={stop} aria-label="Stop response"><Square size={15}/></button> : <button type="submit" className="send-button" disabled={!input.trim()} aria-label="Send message"><ArrowUp size={18}/></button>}</div></form>{error && <div className="error-message" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={14}/></button></div>}<p className="composer-note">Nexora AI preview · Avoid entering sensitive personal information.</p></div>
    </section>
  </div>;
}
