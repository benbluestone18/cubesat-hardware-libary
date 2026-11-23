"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

function active(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

// The top-bar and side-rail links prefetch the whole page, not just the loading shell, so a tab opens
// from data already in the browser (kept for staleTimes in next.config.ts) with no wait on the server.
const RAIL = [
  { href: "/", icon: "home", label: "Feed" },
  { href: "/projects", icon: "folder", label: "Projects" },
  { href: "/people", icon: "team", label: "People" },
  { href: "/weeks", icon: "meeting", label: "Weekly meetings" },
  { href: "/search", icon: "search", label: "Search" },
];

export function Rail({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = admin ? [...RAIL, { href: "/admin", icon: "gear", label: "Admin" }] : RAIL;
  return (
    <nav className="mc-rail mc-glass" aria-label="Main">
      {items.map((i, n) => (
        <span key={i.href} style={{ display: "contents" }}>
          {n === 5 && <span className="mc-rail__sep" />}
          <Link className="mc-icon-btn" href={i.href} prefetch aria-label={i.label} title={i.label} aria-current={active(path, i.href) ? "page" : undefined}>
            <Icon name={i.icon} />
          </Link>
        </span>
      ))}
    </nav>
  );
}

export function ProjectPills({ projects }: { projects: { id: string; name: string }[] }) {
  const path = usePathname();
  return (
    <nav className="mc-nav" aria-label="Projects">
      <Link href="/" prefetch aria-current={path === "/" ? "page" : undefined}>Feed</Link>
      {projects.map((p) => (
        <Link key={p.id} href={`/projects/${p.id}`} prefetch aria-current={active(path, `/projects/${p.id}`) ? "page" : undefined}>{p.name}</Link>
      ))}
    </nav>
  );
}
