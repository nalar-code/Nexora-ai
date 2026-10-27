"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function read(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signIn(formData: FormData) {
  const email = read(formData, "email");
  const password = read(formData, "password");
  if (!email || !password) redirect("/login?error=missing_fields");
  let supabase;
  try { supabase = await createClient(); } catch { redirect("/login?error=supabase_not_configured"); }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid_credentials");
  redirect("/chat");
}

export async function signUp(formData: FormData) {
  const email = read(formData, "email");
  const password = read(formData, "password");
  if (!email || password.length < 8) redirect("/signup?error=invalid_fields");
  let supabase;
  try { supabase = await createClient(); } catch { redirect("/signup?error=supabase_not_configured"); }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.APP_ORIGIN || "http://localhost:3000"}/auth/callback` },
  });
  if (error) redirect("/signup?error=signup_failed");
  redirect("/login?message=check_email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
