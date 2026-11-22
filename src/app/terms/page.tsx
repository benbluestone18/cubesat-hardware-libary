import type { Metadata } from "next";
import Link from "next/link";
import { SCHOOL_DOMAIN } from "@/lib/env";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="legal">
      <p><Link href="/login">Back to sign in</Link></p>
      <h1>Terms of use</h1>
      <p className="muted">Last updated 22 November 2026</p>
      <p>The Hardware Library is run by students on the LG CubeSat team, for the team. By signing in you agree to these terms.</p>
      <ul>
        <li>Only members of the team with an @{SCHOOL_DOMAIN} account may use it.</li>
        <li>Upload only team work: designs, files and notes for the satellite. Don&apos;t upload anything you don&apos;t have the right to share.</li>
        <li>Be respectful in comments and updates. Follow your school&apos;s rules for using technology.</li>
        <li>Edit only what you own or have been given access to. Admins can remove content or accounts that break these rules.</li>
        <li>The library is provided as is, by volunteers. Keep your own copies of important files.</li>
      </ul>
      <p>How we handle your information is covered in the <Link href="/privacy">privacy page</Link>.</p>
    </main>
  );
}
