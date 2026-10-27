import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { signUp } from "@/app/auth/actions";

const errors: Record<string,string> = {
  invalid_fields: "Enter a valid email and a password with at least 8 characters.",
  supabase_not_configured: "Supabase is not configured. Check your .env.local file.",
  signup_failed: "Registration failed. The email may already be registered, or the provider rejected the request.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{error?: string}> }) {
  const params = await searchParams;
  return <main className="auth-page"><Link href="/" className="back-home"><ArrowLeft size={15}/> Back to home</Link><section className="auth-card"><Link className="brand auth-brand" href="/"><span className="brand-mark"><Sparkles size={18}/></span>Nexora <b>AI</b></Link><h1>Create your account.</h1><p>Set up your personal AI workspace.</p>
    {params.error && <div className="error-message" role="alert">{errors[params.error] || "Could not create your account."}</div>}
    <form action={signUp}><label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required/></label><label>Password<input name="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required/></label><button className="button full" type="submit">Create account</button></form>
    <div className="auth-note">You may need to confirm your email before signing in. Configure the redirect URL in your Supabase project.</div><p className="auth-switch">Already have an account? <Link href="/login">Log in</Link></p></section></main>;
}
