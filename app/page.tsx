import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Code2, FileText, Search, ShieldCheck, BrainCircuit, MessageSquare, Check } from "lucide-react";

const features = [
  { icon: MessageSquare, title: "Smart conversations", text: "Explore ideas with an AI assistant that responds with useful context." },
  { icon: Zap, title: "Fast answers", text: "Stream responses so you can start reading while the assistant works." },
  { icon: Code2, title: "Coding companion", text: "Draft code, explain errors, and work through technical questions." },
  { icon: FileText, title: "Document workflows", text: "Designed to grow into file-aware research and analysis." },
  { icon: Search, title: "Research support", text: "Organize questions and turn complex topics into clear next steps." },
  { icon: ShieldCheck, title: "Built with privacy in mind", text: "Keep provider credentials on the server and protect user data." },
];

export default function Home() {
  return <main>
    <nav className="nav wrap">
      <Link className="brand" href="/"><span className="brand-mark"><Sparkles size={19}/></span>Nexora <b>AI</b></Link>
      <div className="nav-links"><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#how">How it works</a></div>
      <div className="nav-actions"><Link href="/login" className="login-link">Log in</Link><Link href="/chat" className="button button-small">Get started <ArrowRight size={15}/></Link></div>
    </nav>

    <section className="hero wrap">
      <div className="hero-copy">
        <div className="eyebrow"><span className="pulse"/> YOUR AI WORKSPACE</div>
        <h1>Your AI assistant.<br/><span>Reimagined.</span></h1>
        <p className="hero-sub">A smarter way to think, create, and work. Bring your questions, ideas, and ambitious projects into one focused workspace.</p>
        <div className="hero-actions"><Link href="/chat" className="button">Start chatting free <ArrowRight size={17}/></Link><a href="#features" className="button button-ghost">Explore features</a></div>
        <div className="trust-note"><span className="avatar-stack"><i>N</i><i>A</i><i>+</i></span><span>Your next great idea starts with a conversation.</span></div>
      </div>
      <div className="hero-visual">
        <div className="glow glow-one"/><div className="glow glow-two"/>
        <div className="preview-window">
          <div className="preview-top"><span className="brand-mark tiny"><Sparkles size={13}/></span><b>Nexora AI</b><span className="preview-model">AI Assistant⌄</span></div>
          <div className="preview-body"><div className="preview-greeting"><div className="spark-large"><Sparkles size={27}/></div><h3>What would you like<br/>to create today?</h3><p>Your ideas, one conversation away.</p></div>
          <div className="prompt-grid"><div><Code2/><b>Generate code</b><small>Build something useful</small></div><div><FileText/><b>Write anything</b><small>Make ideas clearer</small></div><div><Search/><b>Research a topic</b><small>Explore new concepts</small></div><div><BrainCircuit/><b>Think it through</b><small>Plan your next move</small></div></div>
          <div className="fake-input">Ask Nexora anything… <span><ArrowRight size={16}/></span></div></div>
        </div>
        <div className="floating-card floating-top"><span className="float-icon"><Zap size={16}/></span><div><b>Ideas into action</b><small>One prompt at a time</small></div></div>
        <div className="floating-card floating-bottom"><span className="status-dot"/><div><b>AI-powered workspace</b><small>Ready when you are</small></div></div>
      </div>
    </section>

    <section className="feature-section" id="features"><div className="wrap">
      <div className="section-heading"><div className="eyebrow">MADE FOR MOMENTUM</div><h2>Everything you need to<br/><span>move ideas forward.</span></h2><p>From first thought to finished draft, keep your work moving with a versatile AI assistant.</p></div>
      <div className="feature-grid">{features.map(({icon: Icon,title,text})=><article className="feature-card" key={title}><div className="feature-icon"><Icon size={21}/></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </div></section>

    <section className="how-section wrap" id="how"><div className="how-copy"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>Less busywork.<br/><span>More breakthrough.</span></h2><p>Start with a question, collaborate with AI, and shape the result into something useful. Nexora keeps the experience focused on your work.</p><Link href="/chat" className="text-link">Try the chat experience <ArrowRight size={16}/></Link></div>
      <div className="steps">{[{n:"01",t:"Start with a prompt",d:"Describe what you need in plain language."},{n:"02",t:"Explore the answer",d:"Ask follow-ups and refine your direction."},{n:"03",t:"Make it yours",d:"Copy, adapt, and put the result to work."}].map(s=><div className="step" key={s.n}><span>{s.n}</span><div><h3>{s.t}</h3><p>{s.d}</p></div><Check size={17}/></div>)}</div>
    </section>

    <section className="pricing-section" id="pricing"><div className="wrap"><div className="section-heading"><div className="eyebrow">PLANS THAT SCALE WITH YOU</div><h2>Start free. <span>Grow when ready.</span></h2><p>Simple plan concepts for an AI workspace. Final pricing and quotas can be configured before launch.</p></div>
      <div className="pricing-grid"><article className="price-card"><div className="plan-label">STARTER</div><h3>Free</h3><p>Explore AI for everyday tasks.</p><div className="price">Rp0 <small>/ month</small></div><ul><li><Check/>Limited AI usage</li><li><Check/>Chat interface</li><li><Check/>Basic history (planned)</li></ul><Link href="/chat" className="button button-ghost full">Get started</Link></article>
      <article className="price-card featured-price"><div className="popular">POPULAR CONCEPT</div><div className="plan-label">POWER USER</div><h3>Pro</h3><p>For creators and professionals.</p><div className="price">Rp99k <small>/ month*</small></div><ul><li><Check/>Higher usage allowance</li><li><Check/>Expanded AI options</li><li><Check/>Priority features (planned)</li></ul><Link href="/chat" className="button full">Explore Nexora <ArrowRight size={16}/></Link></article>
      <article className="price-card"><div className="plan-label">COLLABORATION</div><h3>Team</h3><p>Bring your team into the workflow.</p><div className="price">Rp299k <small>/ month*</small></div><ul><li><Check/>Team workspace (planned)</li><li><Check/>Shared usage (planned)</li><li><Check/>Admin controls (planned)</li></ul><a href="mailto:sales@example.com" className="button button-ghost full">Contact sales</a></article></div><p className="pricing-note">*Illustrative pricing only. Checkout, paid entitlements, and subscription management are not enabled in this starter.</p>
    </div></section>
    <section className="cta wrap"><div className="cta-orb"><Sparkles size={26}/></div><div><div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div><h2>Ready to think bigger?</h2><p>Bring your curiosity. Let’s make something useful.</p></div><Link href="/chat" className="button">Start a conversation <ArrowRight size={17}/></Link></section>
    <footer className="footer wrap"><Link className="brand" href="/"><span className="brand-mark"><Sparkles size={16}/></span>Nexora <b>AI</b></Link><span>© {new Date().getFullYear()} Nexora AI. Built for thoughtful work.</span><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div></footer>
  </main>;
}
