import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || Number.isNaN(Date.parse(date)) || weekStart(date) !== date) notFound();
  const supabase = await createClient();
  const libP = getLibrary();
  const [lib, { data: week }, updates] = await Promise.all([
    libP,
    supabase.from("weeks").select("*").eq("week_start", date).maybeSingle(),
    recentUpdates(libP, { week: date, limit: 500 }),
  ]);
  const w = week as Week | null;
  const now = weekStart();
  const posted = new Set(updates.map((u) => u.component_id));
  // Parts that existed this week, are still active, and got no update.
  const missing = date <= now ? lib.components.filter((c) => !posted.has(c.id) && c.status !== "released" && c.status !== "built" && c.status !== "on_hold" && c.created_at.slice(0, 10) <= addWeeks(date, 1)) : [];
  const silentOwners = [...new Set(missing.map((c) => c.owner_id))].map((id) => lib.person.get(id)).filter(Boolean);

  return (
    <>
      <PageTitle eyebrow={<><Link href="/weeks">Weekly meetings</Link><span>/</span><span>{weekRange(date)}</span></>} title={`${weekLabel(date)} meeting`}>
        <Link className="mc-icon-btn" href={`/weeks/${addWeeks(date, -1)}`} aria-label="Previous week"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg></Link>
        {date < now && <Link className="mc-icon-btn" href={`/weeks/${addWeeks(date, 1)}`} aria-label="Next week"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg></Link>}
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
                <div className="mc-panel__head"><h2>{p.name}</h2><span className="mc-label">{these.length} updates</span></div>
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
              <div className="mc-panel__head"><h2>No update yet</h2><span className="mc-label">{missing.length} parts</span></div>
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
