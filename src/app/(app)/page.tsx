import Link from "next/link";
import { getLibrary, myMentions, openIssues, peopleHealth, recentUpdates } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { byUrgency, HEALTH_LABEL, type Health } from "@/lib/status";
import { ago, weekLabel, weekRange, weekStart } from "@/lib/week";
import { StaleAlert, UpdateEntry } from "@/components/cards";
import { CommentBody, Face, State, Empty } from "@/components/ui";
import { Icon, StatusIcon } from "@/components/icons";
import { Flash, PageTitle, type SP } from "@/components/flash";

export default async function Feed({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const lib = await getLibrary();
  const thisWeek = weekStart();
  const supabase = await createClient();
  const [updates, people, { data: week }, mentions, issues] = await Promise.all([
    recentUpdates(lib, { limit: 25 }),
    peopleHealth(lib),
    supabase.from("weeks").select("*").eq("week_start", thisWeek).maybeSingle(),
    myMentions(lib, 6),
    openIssues(lib),
  ]);
  const names = lib.people.map((p) => ({ id: p.id, name: p.name }));
  const partOf = (cid: string) => lib.components.find((c) => c.id === cid);

  const active = lib.components.filter((c) => c.status !== "released" && c.status !== "built");
  const alerts = active.filter((c) => c.health.health === "stalled" || c.health.health === "warn").sort(byUrgency);
  const mine = active.filter((c) => c.owner_id === lib.me.id);
  const myTodo = mine.filter((c) => c.status !== "on_hold" && c.latest?.week_start !== thisWeek);

  const counts = lib.components.reduce<Record<Health, number>>((n, c) => ({ ...n, [c.health.health]: n[c.health.health] + 1 }), { done: 0, working: 0, warn: 0, stalled: 0, planned: 0 });
  const order: Health[] = ["done", "working", "warn", "stalled", "planned"];
  const total = lib.components.length;
  const ranked = [...people].filter((p) => p.health).sort((a, b) => {
    const r: Record<string, number> = { stalled: 3, warn: 2, done: 1 };
    return r[b.health!.health] - r[a.health!.health] || b.health!.days - a.health!.days;
  });
  const idle = people.filter((p) => !p.health);

  return (
    <>
      <PageTitle
        eyebrow={<><span>{weekLabel(thisWeek)}</span><span>·</span><span>{weekRange(thisWeek)}</span></>}
        title={`Hi, ${lib.me.name.split(" ")[0]}`}
        sub={total === 0 ? "Nothing in the library yet. Start with a project, then add the parts you own." : `${total} components across ${lib.projects.length} projects. Blocked and quiet work comes first.`}
      />
      <Flash sp={sp} />

      {total > 0 && (
        <section className="mc-panel mc-glass" aria-label="Team health" data-reveal>
          <div className="mc-bar" role="img" aria-label={order.map((h) => `${counts[h]} ${HEALTH_LABEL[h]}`).join(", ")} data-reveal="fill">
            {order.filter((h) => counts[h]).map((h) => <i key={h} style={{ flex: counts[h], background: `var(--status-${h})` }} />)}
          </div>
          <div className="mc-legend">
            {order.map((h) => <div key={h}><b>{counts[h]}</b><span><StatusIcon health={h} />{HEALTH_LABEL[h]}</span></div>)}
          </div>
        </section>
      )}

      <div className="feed-split">
        <div className="stack">
          {myTodo.length > 0 && (
            <section className="mc-panel mc-glass" data-reveal>
              <div className="mc-panel__head"><h2>Your update this week</h2><span className="mc-label">{myTodo.length} to go</span></div>
              <div className="stack-sm">
                {myTodo.map((c) => (
                  <div className="spread" key={c.id}>
                    <div><Link className="link" href={`/components/${c.id}`}>{c.name}</Link><div className="faint" style={{ fontSize: 13 }}>{lib.path(c)}</div></div>
                    <Link className="mc-btn mc-btn--secondary mc-btn--sm" href={`/updates/new?component=${c.id}`}>Write update</Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {alerts.length > 0 && (
            <section className="stack-sm" aria-label="Needs attention">
              {alerts.slice(0, 6).map((c) => {
                const owner = lib.person.get(c.owner_id);
                const blocked = c.health.reason === "Blocked";
                const onHold = c.health.reason === "On hold";
                return (
                  <StaleAlert key={c.id} tone={c.health.health === "stalled" ? "stalled" : "warn"} href={`/components/${c.id}`}
                    title={blocked ? `${c.name} is blocked` : onHold ? `${c.name} is on hold` : c.health.health === "stalled" ? `${c.name} has stalled` : `${c.name} has gone quiet`}
                    body={`${owner?.name ?? "No owner"} · ${blocked ? c.latest?.blocked : lib.path(c)}`}
                    days={c.health.days} />
                );
              })}
              {alerts.length > 6 && <p className="faint" style={{ fontSize: 13 }}>And {alerts.length - 6} more. See each project board.</p>}
            </section>
          )}

          <section className="mc-panel mc-glass">
            <div className="mc-panel__head"><h2>Latest updates</h2><Link className="mc-btn mc-btn--ghost mc-btn--sm" href="/weeks">By week</Link></div>
            {updates.length === 0
              ? <Empty action={<Link className="mc-btn mc-btn--primary mc-btn--sm" href="/updates/new">Post the first update</Link>}>No updates yet. Each week, everyone posts three lines per part: done, next and blocked.</Empty>
              : <div style={{ paddingTop: 8 }}>{updates.map((u, i) => {
                  const c = lib.components.find((x) => x.id === u.component_id)!;
                  return <UpdateEntry key={u.id} u={u} author={lib.person.get(u.author_id)} component={c} path={`${c.name} · ${lib.path(c)}`} last={i === updates.length - 1} />;
                })}</div>}
          </section>
        </div>

        <div className="stack">
          {mentions.length > 0 && (
            <section className="mc-panel mc-glass">
              <div className="mc-panel__head"><h2>Mentioned you</h2><span className="mc-label">{mentions.length}</span></div>
              <div className="stack-sm">
                {mentions.map((m) => {
                  const part = partOf(m.component_id); const who = lib.person.get(m.author_id);
                  return (
                    <Link key={m.id} className="mention-item" href={`/components/${m.component_id}#c-${m.id}`}>
                      <span className="faint" style={{ fontSize: 12 }}>{who?.name.split(" ")[0] ?? "Someone"} on {part?.name} · {ago(m.created_at)}</span>
                      <span className="mention-item__body"><CommentBody body={m.body.length > 160 ? m.body.slice(0, 160) + "…" : m.body} people={names} plain /></span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {issues.length > 0 && (
            <section className="mc-panel mc-glass">
              <div className="mc-panel__head"><h2>Open issues</h2><span className="issue-count">{issues.length}</span></div>
              <div className="stack-sm">
                {issues.slice(0, 8).map((m) => {
                  const part = partOf(m.component_id);
                  return (
                    <Link key={m.id} className="mention-item" href={`/components/${m.component_id}#c-${m.id}`}>
                      <span className="faint" style={{ fontSize: 12 }}>{part?.name} · {lib.person.get(m.author_id)?.name.split(" ")[0]} · {ago(m.created_at)}</span>
                      <span className="mention-item__body">{m.body.length > 120 ? m.body.slice(0, 120) + "…" : m.body}</span>
                    </Link>
                  );
                })}
                {issues.length > 8 && <p className="faint" style={{ fontSize: 13 }}>And {issues.length - 8} more on the project boards.</p>}
              </div>
            </section>
          )}

          <section className="mc-panel mc-glass">
            <div className="mc-panel__head"><h2>This week&apos;s meeting</h2><span className="mc-label">{weekLabel(thisWeek)}</span></div>
            {week?.slides_url
              ? <a className="mc-btn mc-btn--secondary" href={week.slides_url} target="_blank" rel="noreferrer"><Icon name="external" /> Open the slides</a>
              : <p className="muted" style={{ fontSize: 13 }}>No slides linked yet.</p>}
            <Link className="link" href={`/weeks/${thisWeek}`} style={{ fontSize: 13 }}>Agenda and everyone&apos;s updates</Link>
          </section>

          <section className="mc-panel mc-glass">
            <div className="mc-panel__head"><h2>Team</h2><Link className="mc-btn mc-btn--ghost mc-btn--sm" href="/people">All people</Link></div>
            <div className="stack-sm" style={{ gap: 2 }}>
              {ranked.map(({ person, active, latest, health }) => (
                <Link key={person.id} className="person-row" href={`/people/${person.id}`}>
                  <Face person={person} size={36} ring={health!.health} link={false} />
                  <div style={{ minWidth: 0 }}><div className="person-row__name">{person.name}</div><div className="person-row__meta">{active.length} active · last update {ago(latest)}</div></div>
                  <State health={health!.health} label={health!.health === "done" ? "On track" : `${HEALTH_LABEL[health!.health]} ${health!.days}d`} />
                </Link>
              ))}
              {idle.length > 0 && <p className="faint" style={{ fontSize: 13, padding: "8px 8px 0" }}>{idle.length === 1 ? "1 person owns" : `${idle.length} people own`} nothing active yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
