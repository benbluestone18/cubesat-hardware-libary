import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SCHOOL_DOMAIN, emailSignInEnabled } from "@/lib/env";
import { signInWithEmail, signInWithGoogle } from "@/app/actions/auth";
import { safePath } from "@/app/actions/util";

export const metadata: Metadata = { title: "Sign in" };

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safePath(sp.next);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub && !sp.error) redirect(next);

  const error = sp.error === "domain"
    ? `Only @${SCHOOL_DOMAIN} school accounts can sign in. Pick your school account and try again.`
    : sp.error;

  return (
    <div className="mc-ambient login">
      <main className="login__card mc-glass mc-glass--strong">
        <div className="stack-sm">
          <span className="mc-label">LG CubeSat · Hardware</span>
          <h1>Hardware Library</h1>
          <p className="muted">Every part, file and weekly update for the satellite, in one place. Sign in with your school Google account.</p>
        </div>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        {sp.ok && <p className="notice" role="status">{sp.ok}</p>}
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button className="mc-btn mc-btn--primary btn-google" type="submit"><GoogleMark /> Continue with Google</button>
        </form>
        {emailSignInEnabled() && (
          <>
            <div className="or">or get a link by email</div>
            <form action={signInWithEmail} className="stack-sm">
              <input type="hidden" name="next" value={next} />
              <label className="field">
                <span>School email</span>
                <input className="input" type="email" name="email" required autoComplete="email" placeholder={`you@${SCHOOL_DOMAIN}`} pattern={`.+@${SCHOOL_DOMAIN.replace(/\./g, "\\.")}$`} title={`Use your @${SCHOOL_DOMAIN} email`} />
              </label>
              <button className="mc-btn mc-btn--secondary" type="submit">Email me a link</button>
            </form>
          </>
        )}
        <p className="faint" style={{ fontSize: 12 }}>Only @{SCHOOL_DOMAIN} accounts can get in.</p>
      </main>
    </div>
  );
}
