import type { Metadata } from "next";
import Link from "next/link";
import { SCHOOL_DOMAIN } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="legal">
      <p><Link href="/login">Back to sign in</Link></p>
      <h1>Privacy</h1>
      <p className="muted">Last updated 22 November 2026</p>

      <p>The Hardware Library is a private tool for the LG CubeSat team. It holds the team&apos;s hardware parts, files and weekly updates. Only people with an @{SCHOOL_DOMAIN} school account can sign in.</p>

      <h2>What we keep</h2>
      <ul>
        <li>From your Google account, when you sign in: your name, school email address and profile photo. Nothing else is requested from Google.</li>
        <li>What you add: components, files you upload, weekly updates and comments.</li>
        <li>A record of changes (who added, edited or deleted what, and when), so the team can see and undo mistakes.</li>
        <li>Your light or dark theme choice.</li>
      </ul>

      <h2>Who can see it</h2>
      <p>Only signed-in team members. Your name, photo and the things you add are visible to the rest of the team. Your information is not sold, not used for ads and not shared with anyone outside the team.</p>

      <h2>Where it is stored</h2>
      <p>The data lives in a Supabase database in Canada. The website runs on Vercel. Both services keep it on our behalf and do not use it for anything else. Sign-in goes through Google.</p>

      <h2>Removing your data</h2>
      <p>Ask the library admin, who is listed on the People page with the Admin role. They can delete your account and what you added.</p>
    </main>
  );
}
