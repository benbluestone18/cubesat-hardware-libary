import type { Metadata } from "next";
import Link from "next/link";
import { getLibrary, getMemberships, peopleHealth } from "@/lib/data";
import { HEALTH_LABEL } from "@/lib/status";
import { ago } from "@/lib/week";
import { Portrait } from "@/components/cards";
import { Deck } from "@/components/client";
import { Face, State } from "@/components/ui";
import { PageTitle } from "@/components/flash";

export const metadata: Metadata = { title: "People" };

export default async function People() {
  const lib = await getLibrary();
  const [people, memberships] = await Promise.all([peopleHealth(lib), getMemberships()]);
  const teams = (id: string) => memberships.filter((m) => m.person_id === id).map((m) => lib.project.get(m.project_id)?.name).filter(Boolean) as string[];
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
      <section className="mc-panel mc-glass">
        <div className="mc-panel__head"><h2>Everyone</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Projects</th><th>Open parts</th><th>Last update</th><th>State</th></tr></thead>
            <tbody>
              {[...people].sort((a, b) => a.person.name.localeCompare(b.person.name)).map((p) => (
                <tr key={p.person.id}>
                  <td><span className="row"><Face person={p.person} size={28} /><Link className="link" href={`/people/${p.person.id}`}>{p.person.name}</Link>{p.person.role === "admin" && <span className="mc-chip">Admin</span>}</span></td>
                  <td className="muted">{teams(p.person.id).join(", ") || "None"}</td>
                  <td className="mc-data">{p.active.length}</td>
                  <td className="muted">{ago(p.latest)}</td>
                  <td>{p.health ? <State health={p.health.health} label={p.health.health === "done" ? "On track" : `${HEALTH_LABEL[p.health.health]} ${p.health.days}d`} /> : <span className="faint">Nothing active</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
