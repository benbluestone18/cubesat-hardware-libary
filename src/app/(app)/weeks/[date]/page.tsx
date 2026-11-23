import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLibrary, recentUpdates } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Week } from "@/lib/types";
import { addWeeks, weekLabel, weekRange, weekStart } from "@/lib/week";
import { saveWeek } from "@/app/actions/weeks";
import { UpdateEntry } from "@/components/cards";
import { Face, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Flash, PageTitle, type SP } from "@/components/flash";

type Params = Promise<{ date: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { date } = await params;
  return { title: /^\d{4}-\d\d-\d\d$/.test(date) ? `${weekLabel(date)} meeting` : "Week" };
}

export default async function WeekPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { date } = await params;
  const sp = await searchParams;
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || Number.isNaN(Date.parse(date))) notFound();
  // A link to any day goes to the meeting for its week.
  if (weekStart(date) !== date) redirect(`/weeks/${weekStart(date)}`);
  const supabase = await createClient();
  const libP = getLibrary();
  // The arrows skip weeks nobody posted in, like the list of meetings does.
  const nearest = (table: "updates" | "weeks", dir: "before" | "after") => {
    const q = supabase.from(table).select("week_start");
    return (dir === "before" ? q.lt("week_start", date).order("week_start", { ascending: false }) : q.gt("week_start", date).order("week_start")).limit(1);
  };
  const [lib, { data: week }, updates, pu, pw, nu, nw] = await Promise.all([
    libP,
    supabase.from("weeks").select("*").eq("week_start", date).maybeSingle(),
    recentUpdates(libP, { week: date, limit: 500 }),
    nearest("updates", "before"), nearest("weeks", "before"), nearest("updates", "after"), nearest("weeks", "after"),
  ]);
  const first = (rows: { data: { week_start: string }[] | null }[], pick: (a: string, b: string) => string) =>
    rows.flatMap((r) => (r.data ?? []).map((x) => x.week_start)).reduce<string | null>((m, w) => (m ? pick(m, w) : w), null);
  const prevWeek = first([pu, pw], (a, b) => (a > b ? a : b));
  const w = week as Week | null;
  const now = weekStart();
  const later = first([nu, nw], (a, b) => (a < b ? a : b));
  // Forward stops at this week: an empty future week has nothing to show yet.
  const nextWeek = date < now ? (later && later < now ? later : now) : null;
  const posted = new Set(updates.map((u) => u.component_id));
  // Parts that existed this week, are still active, and got no update.
  const missing = date <= now ? lib.components.filter((c) => !posted.has(c.id) && c.status !== "released" && c.status !== "built" && c.status !== "on_hold" && c.created_at.slice(0, 10) <= addWeeks(date, 1)) : [];
  const silentOwners = [...new Set(missing.map((c) => c.owner_id))].map((id) => lib.person.get(id)).filter(Boolean);

  return (
    <>
      <PageTitle eyebrow={<><Link href="/weeks">Weekly meetings</Link><span>/</span><span>{weekRange(date)}</span></>} title={`${weekLabel(date)} meeting`}>
        {prevWeek && <Link className="mc-icon-btn" href={`/weeks/${prevWeek}`} aria-label={`Previous meeting, ${weekLabel(prevWeek)}`}><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg></Link>}
        {nextWeek && <Link className="mc-icon-btn" href={`/weeks/${nextWeek}`} aria-label={`Next meeting, ${weekLabel(nextWeek)}`}><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg></Link>}
        {w?.slides_url && <a className="mc-btn mc-btn--primary" href={w.slides_url} target="_blank" rel="noreferrer"><Icon name="external" /> Open slides</a>}
      </PageTitle>
      <Flash sp={sp} />
      <div className="mc-split">
        <div className="stack">
          {updates.length === 0 && <Empty>No updates posted for {weekLabel(date)}.</Empty>}
          {lib.projects.map((p) => {
            const these = updates.filter((u) => lib.components.find((c) => c.id === u.component_id)?.project_id === p.id);
            if (these.length === 0) return null;
            return (
              <section key={p.id} className="mc-panel mc-glass">
                <div className="mc-panel__head"><h2>{p.name}</h2><span className="mc-label">{these.length} {these.length === 1 ? "update" : "updates"}</span></div>
                <div style={{ paddingTop: 8 }}>{these.map((u, i) => {
                  const c = lib.components.find((x) => x.id === u.component_id)!;
                  return <UpdateEntry key={u.id} u={u} author={lib.person.get(u.author_id)} component={c} path={`${c.name} · ${lib.path(c)}`} last={i === these.length - 1} />;
                })}</div>
              </section>
            );
          })}
        </div>
        <div className="stack">
          <form action={saveWeek} className="mc-panel mc-glass form">
            <input type="hidden" name="week_start" value={date} />
            <label className="field"><span>Slides link</span>
              <input className="input" name="slides_url" type="url" defaultValue={w?.slides_url ?? ""} placeholder="https://docs.google.com/presentation/d/…" />
              <small>The team&apos;s shared deck. Link straight to this week&apos;s slide if you like. Anyone can change it.</small>
            </label>
            <label className="field"><span>Notes</span><textarea className="textarea" name="notes" maxLength={2000} defaultValue={w?.notes ?? ""} placeholder="Agenda, decisions, action items" /></label>
            <div className="form-actions"><button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Save</button></div>
          </form>
          {missing.length > 0 && (
            <section className="mc-panel mc-glass">
              <div className="mc-panel__head"><h2>No update yet</h2><span className="mc-label">{missing.length} {missing.length === 1 ? "part" : "parts"}</span></div>
              <div className="row" style={{ gap: 4 }}>{silentOwners.map((o) => <Face key={o!.id} person={o!} size={28} />)}</div>
              <ul className="stack-sm" style={{ listStyle: "none", margin: 0, padding: 0, gap: 6 }}>
                {missing.map((c) => <li key={c.id} className="spread" style={{ fontSize: 13 }}><Link className="link" href={`/components/${c.id}`}>{c.name}</Link><span className="faint">{lib.person.get(c.owner_id)?.name}</span></li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
