import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLibrary, getMemberships, peopleHealth, recentUpdates } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { byUrgency } from "@/lib/status";
import { updateMyName } from "@/app/actions/people";
import { ComponentCard, Portrait, UpdateEntry } from "@/components/cards";
import { Empty } from "@/components/ui";
import { Flash, type SP } from "@/components/flash";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const lib = await getLibrary();
  return { title: lib.person.get(id)?.name ?? "Person" };
}

export default async function Profile({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const libP = getLibrary();
  const [lib, all, memberships, updates, { data: ed }] = await Promise.all([
    libP, peopleHealth(libP), getMemberships(), recentUpdates(libP, { authorId: id, limit: 15 }),
    supabase.from("component_editors").select("component_id").eq("person_id", id),
  ]);
  const person = lib.person.get(id);
  if (!person) notFound();
  const me = all.find((p) => p.person.id === id)!;
  const teams = memberships.filter((m) => m.person_id === id).map((m) => lib.project.get(m.project_id)?.name).filter(Boolean) as string[];
  const helping = lib.components.filter((c) => (ed ?? []).some((e) => e.component_id === c.id));
  const owned = [...me.owned].sort(byUrgency);
  const isMe = lib.me.id === id;

  return (
    <>
      <h1 className="sr-only">{person.name}</h1>
      <Flash sp={sp} />
      <div className="mc-split" style={{ alignItems: "start" }}>
        <div className="stack">
          <section className="stack-sm">
            <h2 style={{ fontSize: 16 }}>Owns <span className="faint">· {owned.length}</span></h2>
            {owned.length === 0 ? <Empty>{isMe ? "You don't own any parts yet." : `${person.name.split(" ")[0]} doesn't own any parts yet.`}</Empty> : (
              <div className="cards mc-scene">{owned.map((c) => <ComponentCard key={c.id} c={c} owner={person} path={lib.path(c)} />)}</div>
            )}
          </section>
          {helping.length > 0 && (
            <section className="stack-sm">
              <h2 style={{ fontSize: 16 }}>Helps on <span className="faint">· {helping.length}</span></h2>
              <div className="cards mc-scene">{helping.map((c) => <ComponentCard key={c.id} c={c} owner={lib.person.get(c.owner_id)} path={lib.path(c)} />)}</div>
            </section>
          )}
          <section className="mc-panel mc-glass">
            <div className="mc-panel__head"><h2>Recent updates</h2></div>
            {updates.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>None yet.</p> : (
              <div style={{ paddingTop: 8 }}>{updates.map((u, i) => {
                const c = lib.components.find((x) => x.id === u.component_id)!;
                return <UpdateEntry key={u.id} u={u} author={person} component={c} path={`${c.name} · ${lib.path(c)}`} last={i === updates.length - 1} />;
              })}</div>
            )}
          </section>
        </div>
        <div className="stack">
          <div className="mc-deck is-in" style={{ height: 420 }} data-spun="">
            <div data-slot="0" style={{ display: "contents" }}>
              <Portrait person={person} teams={teams} active={me.active.length} latest={me.latest} health={me.health?.health ?? null} joined={person.created_at} />
            </div>
          </div>
          {isMe && (
            <form action={updateMyName} className="mc-panel mc-glass form">
              <label className="field"><span>Your name on the team</span><input className="input" name="name" defaultValue={person.name} required maxLength={80} /><small>Your photo comes from your Google account.</small></label>
              <div className="form-actions"><button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Save name</button></div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
