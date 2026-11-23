"use client";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { saveTheme } from "@/app/actions/people";

/** Sun/moon switch. Saves to a cookie (instant, no flash) and to the profile (follows you across devices). */
export function ThemeToggle() {
  const [, start] = useTransition();
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => saveTheme(next));
  }
  return (
    <button className="mc-icon-btn theme-toggle" type="button" onClick={toggle} aria-label="Switch light or dark mode" title="Switch theme">
      <span className="ic-moon"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" /></svg></span>
      <span className="ic-sun"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></svg></span>
    </button>
  );
}

/** Motion from the design system: scroll reveals, count-ups and the glass spotlight. All off with reduced motion. */
export function Motion() {
  const path = usePathname();
  const firstPath = useRef(path);
  const navigated = useRef(false);
  // A layout effect runs in the same commit as the new page, before the MutationObserver below sees it.
  useLayoutEffect(() => { if (path !== firstPath.current) navigated.current = true; }, [path]);
  useEffect(() => {
    const root = document.documentElement;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("mc-js");
    const count = (el: HTMLElement) => {
      const to = Number(el.dataset.count);
      if (still || !Number.isFinite(to)) { el.textContent = String(to); return; }
      let t0 = 0;
      const f = (t: number) => { t0 = t0 || t; const p = Math.min(1, (t - t0) / 800); el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    };
    const show = (el: Element) => { el.classList.add("is-in"); el.querySelectorAll<HTMLElement>("[data-count]").forEach(count); };
    // Reveals play once, on the first page load. After a click to another page, content shows at once:
    // fading every panel in again made each tab switch feel most of a second slower than it was.
    const instant = (el: Element) => {
      el.classList.add("is-in", "mc-instant");
      el.querySelectorAll<HTMLElement>("[data-count]").forEach((c) => { c.textContent = c.dataset.count ?? c.textContent; });
    };
    const observe = () => {
      const items = document.querySelectorAll("[data-reveal]:not(.is-in)");
      if (navigated.current) { items.forEach(instant); return () => {}; }
      if (still || !("IntersectionObserver" in window)) { items.forEach(show); return () => {}; }
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
      items.forEach((el) => io.observe(el));
      return () => io.disconnect();
    };
    let stop = observe();
    const mo = new MutationObserver(() => { stop(); stop = observe(); });
    mo.observe(document.body, { childList: true, subtree: true });

    // One listener for the whole page instead of one per card.
    let lit: HTMLElement | null = null;
    const glass = ".mc-glass, .mc-ambient .mc-card, .mc-ambient .mc-portrait";
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(glass) ?? null;
      if (lit && lit !== el) lit.classList.remove("is-lit");
      lit = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
      el.classList.add("is-lit");
    };
    const spot = !still && matchMedia("(hover: hover)").matches;
    if (spot) document.addEventListener("pointermove", move, { passive: true });
    return () => { stop(); mo.disconnect(); if (spot) document.removeEventListener("pointermove", move); };
  }, []);
  return null;
}

/** The glass portrait carousel: click a side card, or use the arrows, to bring someone forward. */
export function Deck({ children, count }: { children: React.ReactNode[]; count: number }) {
  const [front, setFront] = useState(0);
  const [spun, setSpun] = useState(false);
  const go = (d: number) => { setSpun(true); setFront((f) => (f + d + count) % count); };
  const pos = (i: number) => {
    if (count === 1) return 0;
    let n = i - front;
    if (n > count / 2) n -= count;
    if (n < -count / 2) n += count;
    return n;
  };
  return (
    <div className="stack-sm" style={{ alignItems: "center" }}>
      <div className="mc-deck" data-reveal data-spun={spun ? "" : undefined} style={{ width: "100%", height: 440 }}
        onClick={(e) => {
          const slot = (e.target as Element).closest<HTMLElement>("[data-slot]");
          const p = Number(slot?.dataset.slot);
          if (slot && p) { e.preventDefault(); go(p); }
        }}>
        {children.map((child, i) => {
          const p = pos(i);
          return <div key={i} style={{ display: "contents" }} data-slot={Math.abs(p) <= 1 ? p : "hidden"}>{child}</div>;
        })}
      </div>
      {count > 1 && (
        <div className="row">
          <button type="button" className="mc-icon-btn" onClick={() => go(-1)} aria-label="Previous person"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg></button>
          <span className="mc-label">{front + 1} / {count}</span>
          <button type="button" className="mc-icon-btn" onClick={() => go(1)} aria-label="Next person"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg></button>
        </div>
      )}
    </div>
  );
}

/** A submit button that asks once before a destructive action, in the page, never with a browser dialog. */
export function ConfirmButton({ children, confirmLabel = "Confirm", className = "mc-btn mc-btn--secondary mc-btn--sm" }: { children: React.ReactNode; confirmLabel?: string; className?: string }) {
  return (
    <details className="inline" style={{ display: "inline-block" }}>
      <summary className={className} role="button">{children}</summary>
      <span className="row"><button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit" style={{ color: "var(--status-stalled)" }}>{confirmLabel}</button></span>
    </details>
  );
}
