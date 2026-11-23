import Link from "next/link";
import { StatusIcon } from "./icons";
import { HEALTH_LABEL, STATUS_LABEL, STATUS_STEP, type ComponentStatus, type Health, type HealthResult } from "@/lib/status";
import type { Person } from "@/lib/types";
import { splitMentions } from "@/lib/mentions";
import { fill } from "@/lib/budget";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

/** A person's face: their Google photo, or initials. Links to their profile. */
export function Face({ person, size = 32, ring, link = true }: { person: Pick<Person, "id" | "name" | "avatar_url">; size?: number; ring?: Health | null; link?: boolean }) {
  const inner = person.avatar_url
    // eslint-disable-next-line @next/next/no-img-element -- Google avatars, small and already sized
    ? <img src={person.avatar_url} alt="" referrerPolicy="no-referrer" />
    : initials(person.name);
  const style = { "--size": `${size}px` } as React.CSSProperties;
  const face = link
    ? <Link className="face" href={`/people/${person.id}`} style={style} title={person.name} aria-label={person.name}>{inner}</Link>
    : <span className="face" style={style} aria-hidden="true">{inner}</span>;
  if (!ring || ring === "working" || ring === "planned") return face;
  return <span className={`face-ring face-ring--${ring}`}>{face}</span>;
}

/** Icon and word, in the status color. */
export function State({ health, label }: { health: Health; label?: string }) {
  return <span className={`state state--${health}`}><StatusIcon health={health} />{label ?? HEALTH_LABEL[health]}</span>;
}

export function HealthState({ h }: { h: HealthResult }) {
  const label = h.health === "stalled" || h.health === "warn" ? (h.reason === "On hold" || h.reason === "Blocked" ? h.reason : `${HEALTH_LABEL[h.health]} ${h.days}d`) : h.reason;
  return <State health={h.health} label={label} />;
}

/** Five-step lifecycle track: Planned, In design, In review, Released, Built. */
export function Track({ status, health }: { status: ComponentStatus; health: Health }) {
  const step = STATUS_STEP[status];
  const tone = health === "stalled" ? " mc-track--stalled" : health === "done" ? " mc-track--done" : "";
  return (
    <div className={`mc-track${tone}`} role="img" aria-label={`${STATUS_LABEL[status]}, step ${step || "—"} of 5`} data-reveal="fill">
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= step ? "on" : undefined} />)}
    </div>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="empty"><p>{children}</p>{action}</div>;
}

/** A comment's text with @mentions turned into links to the person. */
export function CommentBody({ body, people, plain = false }: { body: string; people: { id: string; name: string }[]; plain?: boolean }) {
  return (
    <>
      {splitMentions(body, people).map((part, i) => "person" in part
        ? plain ? <b key={i} className="mention-link">{part.text}</b> : <Link key={i} className="mention-link" href={`/people/${part.person.id}`}>{part.text}</Link>
        : <span key={i}>{part.text}</span>)}
    </>
  );
}

/** A thin bar showing how much of a budget is used. */
export function BudgetBar({ used, limit, label }: { used: number; limit: number | null; label: string }) {
  const f = fill(used, limit);
  if (!f) return null;
  return (
    <span className={`budget-bar budget-bar--${f.tone}`} role="img" aria-label={`${label}: ${Math.round(f.pct)}% of the budget`}>
      <i style={{ width: `${Math.min(100, f.pct)}%` }} />
    </span>
  );
}
