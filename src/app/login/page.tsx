import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import photo from "../../../public/login/cubesats-iss.jpg";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SCHOOL_DOMAIN, emailSignInEnabled, googleSignInEnabled } from "@/lib/env";
import { EmailForm, GoogleForm } from "./sign-in-forms";
import { safePath } from "@/app/actions/util";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safePath(sp.next);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub && !sp.error) redirect(next);

  const google = googleSignInEnabled();
  const email = emailSignInEnabled();
  const error = sp.error === "domain"
    ? `Only @${SCHOOL_DOMAIN} school accounts can sign in. Use your school email and try again.`
    : sp.error;

  return (
    <div className="login">
      <section className="login__scene">
        <Image src={photo} alt="Two CubeSats drifting away from the International Space Station, high above Earth" fill priority placeholder="blur" sizes="(max-width: 860px) 100vw, 55vw" className="login__photo" />
        <p className="login__credit">Photo: NASA</p>
      </section>
      <div className="login__intro">
        <p className="login__mark">LG CubeSat</p>
        <h1>Hardware<br />Library</h1>
        <p className="login__lede">Every part, file and weekly update for the satellite, in one place.</p>
      </div>
      <main className="login__panel">
        <div className="login__form">
          <h2>Sign in</h2>
          <p className="muted">
            {email ? `Enter your @${SCHOOL_DOMAIN} school email and we'll send you a sign-in link.` : `Use your @${SCHOOL_DOMAIN} Google account.`}
            {" "}The first time you sign in, your profile is made for you.
          </p>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          {google && <GoogleForm next={next} />}
          {google && email && <div className="or">or get a link by email</div>}
          {email && <EmailForm next={next} domain={SCHOOL_DOMAIN} primary={!google} />}
          <p className="login__legal"><Link href="/privacy">Privacy</Link> and <Link href="/terms">terms</Link></p>
        </div>
      </main>
    </div>
  );
}
