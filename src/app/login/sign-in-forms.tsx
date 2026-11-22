"use client";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendEmailLink, signInWithGoogle, type EmailLinkState } from "@/app/actions/auth";

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

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-google" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <><Spinner /> Opening Google…</> : <><GoogleMark /> Continue with Google</>}
    </button>
  );
}

export function GoogleForm({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <GoogleButton />
    </form>
  );
}

/** Seconds left until `until` (a time in ms), ticking once a second. */
function useSecondsLeft(until: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

function SendButton({ wait, label }: { wait: number; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="mc-btn mc-btn--secondary" type="submit" disabled={pending || wait > 0} aria-busy={pending}>
      {pending ? <><Spinner /> Sending link…</> : wait > 0 ? `${label} in ${wait}s` : label}
    </button>
  );
}

const IDLE: EmailLinkState = { status: "idle" };

export function EmailForm({ next, domain }: { next: string; domain: string }) {
  const [state, send] = useActionState(sendEmailLink, IDLE);
  // The retry time of a "sent" result the person chose to leave, to type a different address.
  const [left, setLeft] = useState<number | null>(null);
  const wait = useSecondsLeft(state.status === "idle" ? undefined : state.retryAt);
  const email = state.status === "idle" ? "" : state.email;

  if (state.status === "sent" && left !== state.retryAt) {
    return (
      <div className="sent" role="status" aria-live="polite">
        <span className="sent__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
        </span>
        <div className="sent__body">
          <p className="sent__title">Check your email</p>
          <p>We sent a sign-in link to <strong>{state.email}</strong>. It can take a minute to arrive, and it often lands in <strong>spam</strong>. The link works once and expires in an hour.</p>
        </div>
        <form action={send} className="sent__actions">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="email" value={state.email} />
          <SendButton wait={wait} label="Send another link" />
          <button type="button" className="link-btn" onClick={() => setLeft(state.retryAt)}>Use a different email</button>
        </form>
      </div>
    );
  }

  return (
    <form action={send} className="stack-sm">
      <input type="hidden" name="next" value={next} />
      {state.status === "error" && <p className="notice notice--error" role="alert">{state.message}</p>}
      <label className="field">
        <span>School email</span>
        <input className="input" type="email" name="email" required autoComplete="email" defaultValue={email} key={email} placeholder={`you@${domain}`} pattern={`.+@${domain.replace(/\./g, "\\.")}$`} title={`Use your @${domain} email`} />
      </label>
      <SendButton wait={state.status === "error" ? wait : 0} label="Email me a link" />
    </form>
  );
}
