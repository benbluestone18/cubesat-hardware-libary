import type { Health } from "@/lib/status";

const line = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const paths: Record<string, React.ReactNode> = {
  home: <path d="M2.5 7.5L8 3l5.5 4.5V13h-3.5V9.5h-4V13H2.5z" />,
  folder: <path d="M2 4.5h4l1.5 1.5H14v6.5H2z" />,
  team: <><circle cx="6" cy="6" r="2.5" /><path d="M1.5 13c.5-2.3 2.3-3.5 4.5-3.5s4 1.2 4.5 3.5M10.5 3.8a2.3 2.3 0 0 1 0 4.4M12 9.8c1.4.4 2.3 1.5 2.5 3.2" /></>,
  chip: <><rect x="4" y="4" width="8" height="8" rx="1.5" /><path d="M6 1.5v2.5M10 1.5v2.5M6 12v2.5M10 12v2.5M1.5 6h2.5M1.5 10h2.5M12 6h2.5M12 10h2.5" /></>,
  meeting: <><rect x="2" y="3" width="12" height="8" rx="1.5" /><path d="M8 11v3M5.5 14h5" /></>,
  search: <><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></>,
  plus: <path d="M8 3v10M3 8h10" />,
  dots: <><circle cx="3.5" cy="8" r=".6" fill="currentColor" /><circle cx="8" cy="8" r=".6" fill="currentColor" /><circle cx="12.5" cy="8" r=".6" fill="currentColor" /></>,
  external: <path d="M6 2.5h7.5V10M13.5 2.5L7 9M11 11v2.5H2.5V5H5" />,
  upload: <path d="M8 10V2.5M5 5.5L8 2.5l3 3M3 9v4h10V9" />,
  download: <path d="M8 2.5V10M5 7l3 3 3-3M3 11v2h10v-2" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" />,
  gear: <><circle cx="8" cy="8" r="2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" /></>,
  logout: <path d="M6 2.5H3v11h3M10 5l3 3-3 3M13 8H6" />,
  edit: <path d="M10.5 2.5l3 3L6 13H3v-3z" />,
  calendar: <><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 7h11M5.5 2v3M10.5 2v3" /></>,
  message: <path d="M2.5 3.5h11v7.5H7l-3 2.5V11H2.5z" />,
  restore: <path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5" />,
  arrow: <path d="M2 6h8M7 3l3 3-3 3" />,
  chevron: <path d="M6 4l4 4-4 4" />,
  file: <path d="M4 1.5h5l3 3v10H4zM9 1.5v3h3" />,
};

export function Icon({ name, size = 16 }: { name: keyof typeof paths | string; size?: number }) {
  return <svg {...line} width={size} height={size}>{paths[name]}</svg>;
}

/** The five status shapes. Always shown with a word next to them, never on their own. */
export function StatusIcon({ health, size = 12 }: { health: Health; size?: number }) {
  const p = { viewBox: "0 0 12 12", width: size, height: size, "aria-hidden": true };
  switch (health) {
    case "done":
      return <svg {...p}><circle cx="6" cy="6" r="6" fill="currentColor" /><path d="M3.4 6.2l1.8 1.8 3.4-3.6" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "working":
      return <svg {...p}><circle cx="6" cy="6" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 .8a5.2 5.2 0 0 1 0 10.4z" fill="currentColor" /></svg>;
    case "warn":
      return <svg {...p}><circle cx="6" cy="6" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 3.2V6l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
    case "stalled":
      return <svg {...p}><path d="M6 .6l5.6 10.2H.4z" fill="currentColor" /><path d="M6 4.4v3" stroke="var(--surface)" strokeWidth="1.5" strokeLinecap="round" /><circle cx="6" cy="9.1" r=".8" fill="var(--surface)" /></svg>;
    default:
      return <svg {...p}><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.6" /></svg>;
  }
}
