import Link from "next/link";
import { Icon, StatusIcon } from "./icons";
import { Face, HealthState, Track, initials } from "./ui";
import { STATUS_LABEL, STATUS_STEP, type Health } from "@/lib/status";
import { ago, shortDate, weekLabel } from "@/lib/week";
import type { ComponentWithHealth } from "@/lib/data";
import type { Person, Update } from "@/lib/types";

/** The glass component card: face, name over path, a sunken well with the track and state, then rev and Onshape. */
export function ComponentCard({ c, owner, path }: { c: ComponentWithHealth; owner?: Person; path: string }) {
  const h = c.health;
  const stalled = h.health === "stalled";
  return (
    <article className={`mc-card mc-cc${stalled ? " mc-cc--stalled mc-card--stalled" : h.health === "warn" ? " mc-card--warn" : ""}`}>
      <div className="mc-cc__head">
        {owner ? <Face person={owner} size={40} /> : <span className="face" style={{ "--size": "40px" } as React.CSSProperties} />}
        <div className="mc-cc__name"><Link href={`/components/${c.id}`}>{c.name}</Link>{path}</div>
        <Link className="mc-icon-btn mc-icon-btn--sm" href={`/components/${c.id}`} aria-label={`Open ${c.name}`}><Icon name="dots" /></Link>
      </div>
      <div className="mc-cc__well">
        <Track status={c.status} health={h.health} />
        <div className="mc-cc__row">
          <span className="mc-cc__state"><HealthState h={h} /></span>
          <span className="mc-label">{c.status === "on_hold" ? "On hold" : `Step ${STATUS_STEP[c.status]} of 5`}</span>
        </div>
      </div>
      <div className="mc-cc__foot">
        <span className="mc-data">REV {c.revision.toUpperCase()}</span>
        <div className="row">
          <span className="mc-muted">{c.last_update_at ? ago(c.last_update_at) : "No updates"}</span>
          {c.onshape_url && (
            <a className="mc-icon-btn mc-icon-btn--sm" href={c.onshape_url} target="_blank" rel="noreferrer" aria-label="Open in Onshape"><Icon name="external" /></a>
          )}
        </div>
      </div>
    </article>
  );
}

/** A weekly update as a mission log entry: date in the gutter, a rail with a status node, then done, next and blocked. */
export function UpdateEntry({ u, author, component, path, last }: { u: Update; author?: Person; component: { id: string; name: string; status: keyof typeof STATUS_LABEL }; path: string; last?: boolean }) {
  const blocked = u.blocked.trim();
  const node = blocked ? "stalled" : component.status === "released" || component.status === "built" ? "done" : "working";
  return (
    <div className="mc-log" style={last ? { marginBottom: -28 } : undefined}>
      <div className="mc-log__time"><b>{shortDate(u.created_at)}</b><span className="mc-label">{weekLabel(u.week_start)}</span></div>
      <div className="mc-log__rail"><span className={`mc-log__node mc-log__node--${node}`} /></div>
      <div className="mc-log__body">
        <div className="mc-log__who">
          {author ? <Link href={`/people/${author.id}`} style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "none" }}>{author.name}</Link> : <b>Someone</b>}
          <Link href={`/components/${component.id}`}>{path}</Link>
        </div>
        {u.done.trim() && <p className="mc-log__done">{u.done}</p>}
        <ul className="mc-log__lines">
          <li><span>Status</span><span><span className={`state state--${node === "stalled" ? "working" : node}`}><StatusIcon health={node === "done" ? "done" : "working"} />{STATUS_LABEL[component.status]}</span></span></li>
          {u.next.trim() && <li><span>Next</span><span>{u.next}</span></li>}
          {blocked && <li className="is-blocked"><span><StatusIcon health="stalled" size={11} />Blocked</span><span>{blocked}</span></li>}
        </ul>
      </div>
    </div>
  );
}

/** A stall alert: icon, title, one line, and the days in the corner. */
export function StaleAlert({ tone, title, body, days, href }: { tone: "stalled" | "warn"; title: string; body: string; days: number; href?: string }) {
  const inner = (
    <>
      <StatusIcon health={tone} size={18} />
      <div><div className="mc-alert__title">{title}</div><div className="mc-alert__body">{body}</div></div>
      <span className="mc-alert__days">{days}d</span>
    </>
  );
  return href
    ? <Link className={`mc-alert mc-alert--${tone}`} role="status" href={href} style={{ textDecoration: "none" }}>{inner}</Link>
    : <div className={`mc-alert mc-alert--${tone}`} role="status">{inner}</div>;
}

/** The glass portrait: big face with a status ring, name, teams, open parts and one line about their week. */
export function Portrait({ person, teams, active, latest, health, joined }: { person: Person; teams: string[]; active: number; latest: string | null; health: Health | null; joined: string }) {
  const tone = health === "stalled" ? " mc-portrait--stalled" : health === "warn" ? " mc-portrait--warn" : !health ? " mc-portrait--plain" : "";
  const since = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(joined));
  const line = latest ? `Last update ${ago(latest).toLowerCase()}. Here since ${since}.` : `No updates yet. Here since ${since}.`;
  return (
    <Link className={`mc-portrait${tone}`} href={`/people/${person.id}`}>
      <div className="mc-portrait__face">
        {/* eslint-disable-next-line @next/next/no-img-element -- Google avatar */}
        {person.avatar_url ? <img src={person.avatar_url} alt="" referrerPolicy="no-referrer" /> : initials(person.name)}
        {health && <StatusIcon health={health} />}
      </div>
      <p className="mc-portrait__name">{person.name}</p>
      <p className="mc-portrait__teams">{teams.length ? teams.join(" · ") : "No project yet"}</p>
      <span className="mc-portrait__pill">{active} open</span>
      <p className="mc-portrait__line">{line}</p>
    </Link>
  );
}
