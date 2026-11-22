import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Google and email links land here with a one-time code, which becomes a session cookie. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const code = url.searchParams.get("code");
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, url.origin));

  // The database refuses accounts outside the school domain, and Supabase reports it as a failed save.
  const err = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (err) return fail(/database error/i.test(err) ? "domain" : "Sign-in was cancelled or failed. Try again.");
  if (!code) return fail("That sign-in link is missing its code. Try again.");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(/database error/i.test(error.message) ? "domain" : "That sign-in link has expired. Ask for a new one.");
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
