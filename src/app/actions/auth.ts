"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SCHOOL_DOMAIN, emailSignInEnabled } from "@/lib/env";
import { safePath, str } from "./util";

/** The site's own address, for the link Google or the email sends people back to. */
async function origin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function callback(base: string, next: string) {
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithGoogle(form: FormData) {
  const next = safePath(str(form, "next"), "/");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback(await origin(), next),
      // hd asks Google to show school accounts only. The database still refuses any other domain.
      queryParams: { hd: SCHOOL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent("Google sign-in isn't set up yet. Ask the admin.")}`);
  redirect(data.url);
}

export async function signInWithEmail(form: FormData) {
  const next = safePath(str(form, "next"), "/");
  const email = str(form, "email", 200).toLowerCase();
  const retry = (msg: string, kind = "error") => redirect(`/login?${kind}=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`);
  if (!emailSignInEnabled()) retry("Email sign-in is turned off. Use Google.");
  if (!email.endsWith("@" + SCHOOL_DOMAIN)) retry(`Use your @${SCHOOL_DOMAIN} school email`);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback(await origin(), next) } });
  if (error) retry(error.status === 429 ? "Too many emails. Wait a minute and try again." : "Couldn't send the email. Try Google instead.");
  retry(`Check ${email} for a sign-in link`, "ok");
}
