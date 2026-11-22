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
    <div className="login">
      <section className="login__scene" aria-hidden="true">
        <OrbitScene />
      </section>
      <div className="login__intro">
        <p className="login__mark">LG CubeSat</p>
        <h1>Hardware<br />Library</h1>
        <p className="login__lede">Every part, file and weekly update for the satellite, in one place.</p>
      </div>
      <main className="login__panel">
        <div className="login__form">
          <h2>Sign in</h2>
          <p className="muted">Use your @{SCHOOL_DOMAIN} Google account. The first time you sign in, your profile is made for you.</p>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          {sp.ok && <p className="notice" role="status">{sp.ok}</p>}
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button className="btn-google" type="submit"><GoogleMark /> Continue with Google</button>
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
        </div>
      </main>
    </div>
  );
}

// Fixed star positions so the server and browser draw the same sky.
const STARS = [
  [140, 210, .8], [228, 54, 1], [310, 150, .7], [420, 40, 1.3], [505, 190, .8], [590, 70, 1],
  [690, 160, 1.2], [760, 50, .7], [96, 330, .9], [250, 290, .7], [655, 300, .9], [740, 380, .8], [380, 260, .6],
  [30, 470, .8], [560, 420, .7], [170, 520, .6], [780, 560, 1],
] as const;

function OrbitScene() {
  return (
    <svg className="orbit" viewBox="0 0 800 900" preserveAspectRatio="xMidYMax slice">
      <defs>
        <radialGradient id="earth" cx="50%" cy="0%" r="75%">
          <stop offset="0" stopColor="#3b7fd9" />
          <stop offset=".35" stopColor="#1d4f99" />
          <stop offset="1" stopColor="#0a1f45" />
        </radialGradient>
        <filter id="haze" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" /></filter>
      </defs>
      {STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} className="orbit__star" />)}
      <circle cx="400" cy="1560" r="880" className="orbit__air" filter="url(#haze)" />
      <circle cx="400" cy="1560" r="870" fill="url(#earth)" />
      <circle cx="400" cy="1560" r="1010" className="orbit__path" />
      <g className="orbit__sat">
        <g transform="translate(400 550) rotate(-8)">
          <rect x="-58" y="-9" width="40" height="18" rx="2" className="orbit__panel" />
          <rect x="18" y="-9" width="40" height="18" rx="2" className="orbit__panel" />
          <path d="M-38 -9v18M-28 -9v18M28 -9v18M38 -9v18M-58 0h40M18 0h40" className="orbit__cells" />
          <line x1="-18" y1="0" x2="18" y2="0" className="orbit__strut" />
          <rect x="-13" y="-13" width="26" height="26" rx="3" className="orbit__body" />
          <rect x="-7" y="-7" width="14" height="14" rx="1.5" className="orbit__lens" />
        </g>
      </g>
    </svg>
  );
}
