import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safePath } from "@/app/actions/util";

/**
 * Email sign-in links land here. Unlike /auth/callback, this works on any device or browser,
 * not only the one that asked for the email, and lasts as long as the email link (an hour by default).
 * The Supabase "Magic link" and "Confirm signup" templates must point here (see README).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;
  const next = safePath(url.searchParams.get("next"));
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, url.origin));
  if (!tokenHash) return fail("That sign-in link is missing its code. Ask for a new one.");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return fail(/database error/i.test(error.message) ? "domain" : "That sign-in link has expired or was already used. Ask for a new one.");
  return NextResponse.redirect(new URL(next, url.origin));
}
