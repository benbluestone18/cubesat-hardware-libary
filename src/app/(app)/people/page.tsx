import type { Metadata } from "next";
import Link from "next/link";
import { getLibrary, getMemberships, peopleHealth } from "@/lib/data";
import { personStateLabel } from "@/lib/status";
import { ago } from "@/lib/week";
import { Portrait } from "@/components/cards";
import { Deck } from "@/components/client";
import { Face, State } from "@/components/ui";
import { PageTitle } from "@/components/flash";

export const metadata: Metadata = { title: "People" };

export default async function People() {
  const libP = getLibrary();
  const [lib, people, memberships] = await Promise.all([libP, peopleHealth(libP), getMemberships()]);
  const teams = (id: string) => memberships.filter((m) => m.person_id === id).map((m) => lib.project.get(m.project_id)?.name).filter(Boolean) as string[];
  // One section per team, leads first; then everyone who hasn't joined a team.
  const byName = (a: { p: (typeof people)[number] }, b: { p: (typeof people)[number] }) => a.p.person.name.localeCompare(b.p.person.name);
  const groups: { key: string; title: string; href?: string; projectId?: string; rows: { p: (typeof people)[number]; lead: boolean }[] }[] = lib.projects.map((proj) => ({
    key: proj.id, title: proj.name, href: `/projects/${proj.id}`, projectId: proj.id,
    rows: memberships.filter((m) => m.project_id === proj.id)
      .map((m) => ({ p: people.find((x) => x.person.id === m.person_id)!, lead: m.lead }))
      .filter((r) => r.p)
      .sort((a, b) => Number(b.p.person.id === proj.owner_id) - Number(a.p.person.id === proj.owner_id) || Number(b.lead) - Number(a.lead) || byName(a, b)),
  }));
  const loose = people.filter((p) => !memberships.some((m) => m.person_id === p.person.id && lib.project.has(m.project_id)));
  if (loose.length) groups.push({ key: "none", title: "Not on a team yet", rows: loose.map((p) => ({ p, lead: false })).sort(byName) });
  // Start the carousel on you.
  const ordered = [...people].sort((a, b) => Number(b.person.id === lib.me.id) - Number(a.person.id === lib.me.id) || a.person.name.localeCompare(b.person.name));
  return (
    <>
      <PageTitle title="People" sub={`${people.length} on the hardware team. Rings show who's posting: green on track, amber quiet for 7 days, red stalled for 14.`} />
      <section className="mc-panel mc-glass" style={{ padding: "8px 0 20px", overflow: "hidden" }}>
        <Deck count={ordered.length}>
          {ordered.map((p) => <Portrait key={p.person.id} person={p.person} teams={teams(p.person.id)} active={p.active.length} latest={p.latest} health={p.health?.health ?? null} joined={p.person.created_at} />)}
        </Deck>
      </section>
      {groups.map((g) => (
        <section key={g.key} className="mc-panel mc-glass">
          <div className="mc-panel__head">
            <h2>{g.href ? <Link className="link" href={g.href}>{g.title}</Link> : g.title}</h2>
            <span className="mc-label">{g.rows.length}</span>
          </div>
          {g.rows.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No one on this team yet. Open the project to add people.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th className="hide-sm">Also on</th><th className="hide-sm">Open parts</th><th>Last update</th><th>State</th></tr></thead>
                <tbody>
                  {g.rows.map(({ p, lead }) => (
                    <tr key={p.person.id}>
                      <td><span className="row"><Face person={p.person} size={28} /><Link className="link" href={`/people/${p.person.id}`}>{p.person.name}</Link>{g.projectId && lib.project.get(g.projectId)?.owner_id === p.person.id ? <span className="mc-chip">Owner</span> : lead && <span className="mc-chip">Lead</span>}{p.person.role === "admin" && <span className="mc-chip">Admin</span>}</span></td>
                      <td className="muted hide-sm">{teams(p.person.id).filter((t) => t !== g.title).join(", ") || "None"}</td>
                      <td className="mc-data hide-sm">{(g.projectId ? p.active.filter((c) => c.project_id === g.projectId) : p.active).length}</td>
                      <td className="muted">{ago(p.latest)}</td>
                      <td>{p.health ? <State health={p.health.health} label={personStateLabel(p.health)} /> : <span className="faint">Nothing active</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
