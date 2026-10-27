import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { signIn } from "@/app/auth/actions";

const errors: Record<string,string> = {
  missing_fields: "Enter your email and password.",
  invalid_credentials: "Email or password is incorrect.",
  supabase_not_configured: "Supabase is not configured. Check your .env.local file.",
  auth_callback_failed: "Email confirmation failed. Try the link again or request a new one.",
};
export default async function LoginPage({ searchParams }: { searchParams: Promise<{error?: string; message?: string}> }) {
  const params = await searchParams;
  return <main className="auth-page"><Link href="/" className="back-home"><ArrowLeft size={15}/> Back to home</Link><section className="auth-card"><Link className="brand auth-brand" href="/"><span className="brand-mark"><Sparkles size={18}/></span>Nexora <b>AI</b></Link><h1>Welcome back.</h1><p>Sign in to continue to your workspace.</p>
    {params.error && <div className="error-message" role="alert">{errors[params.error] || "Could not sign in."}</div>}
    {params.message === "check_email" && <div className="auth-note" role="status">Account created. Check your email to confirm your address, then sign in.</div>}
    <form action={signIn}><label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required/></label><label>Password<input name="password" type="password" placeholder="Enter your password" autoComplete="current-password" required/></label><button className="button full" type="submit">Continue</button></form>
    <p className="auth-switch">New to Nexora? <Link href="/signup">Create an account</Link></p></section></main>;
}
