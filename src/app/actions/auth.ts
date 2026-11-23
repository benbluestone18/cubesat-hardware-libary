"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SCHOOL_DOMAIN, emailSignInEnabled, googleSignInEnabled } from "@/lib/env";
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
  // A server action can be called even when its button is hidden, so check here too.
  if (!googleSignInEnabled()) redirect(`/login?error=${encodeURIComponent("Google sign-in is turned off. Use your school email instead.")}`);
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

export type EmailLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string; retryAt: number }
  | { status: "error"; message: string; email: string; retryAt?: number };

/** Sends a sign-in link and reports back to the form, so the page can show what happened without reloading. */
export async function sendEmailLink(_prev: EmailLinkState, form: FormData): Promise<EmailLinkState> {
  const next = safePath(str(form, "next"), "/");
  const email = str(form, "email", 200).toLowerCase();
  const fail = (message: string, retryAt?: number): EmailLinkState => ({ status: "error", message, email, retryAt });
  if (!emailSignInEnabled()) return fail("Email sign-in is turned off. Use Continue with Google.");
  if (!email.endsWith("@" + SCHOOL_DOMAIN)) return fail(`Use your @${SCHOOL_DOMAIN} school email.`);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback(await origin(), next) } });
  if (error) {
    if (error.status === 429) {
      // One email per address per minute: Supabase says how many seconds are left.
      const left = /(\d+)\s*second/i.exec(error.message)?.[1];
      if (left) return fail("A link was already sent to this address in the last minute. Check your inbox and spam before asking for another.", Date.now() + Number(left) * 1000);
      // Otherwise the whole site hit its hourly email limit.
      return fail("The library has sent too many sign-in emails this hour. Try again in a little while.", Date.now() + 60_000);
    }
    return fail("Couldn't send the email. Wait a minute and try again, or tell the admin.");
  }
  return { status: "sent", email, retryAt: Date.now() + 60_000 };
}
