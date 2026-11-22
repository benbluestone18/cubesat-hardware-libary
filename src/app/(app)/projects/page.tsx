import type { Metadata } from "next";
import Link from "next/link";
import { getLibrary, getMemberships } from "@/lib/data";
import { worst } from "@/lib/status";
import { createProject } from "@/app/actions/projects";
import { Face, State, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Flash, PageTitle, type SP } from "@/components/flash";

export const metadata: Metadata = { title: "Projects" };

const PROJECT_STATUS = { active: "Active", paused: "Paused", done: "Done" } as const;

export default async function Projects({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [lib, memberships] = await Promise.all([getLibrary(), getMemberships()]);
  return (
    <>
      <PageTitle title="Projects" sub="Each hardware area of the satellite. Anyone on the team can add a project or folder.">
        <details className="inline">
          <summary className="mc-btn mc-btn--primary"><Icon name="plus" /> New project</summary>
          <form action={createProject} className="form mc-panel mc-glass popover" style={{ width: "min(420px, calc(100vw - 32px))" }}>
            <label className="field"><span>Name</span><input className="input" name="name" required maxLength={80} placeholder="ADCS" /></label>
            <label className="field"><span>What it covers</span><textarea className="textarea" name="description" maxLength={2000} placeholder="Attitude determination and control: magnetorquers, sun sensors, IMU" /></label>
            <div className="form-actions"><button className="mc-btn mc-btn--primary" type="submit">Create project</button></div>
          </form>
        </details>
      </PageTitle>
      <Flash sp={sp} />
      {lib.projects.length === 0 ? (
        <Empty>No projects yet. Create one for each hardware area, like ADCS or Biomission.</Empty>
      ) : (
        <div className="cards mc-scene">
          {lib.projects.map((p) => {
            const comps = lib.components.filter((c) => c.project_id === p.id);
            const active = comps.filter((c) => c.status !== "released" && c.status !== "built");
            const health = comps.length ? worst(comps.map((c) => c.health.health)) : "planned";
            const members = memberships.filter((m) => m.project_id === p.id).map((m) => lib.person.get(m.person_id)).filter(Boolean);
            return (
              <article key={p.id} className={`mc-card${health === "stalled" ? " mc-card--stalled" : health === "warn" ? " mc-card--warn" : ""}`} data-reveal>
                <div className="mc-card__head">
                  <div className="mc-card__title"><Link href={`/projects/${p.id}`} style={{ color: "inherit", textDecoration: "none" }}>{p.name}</Link></div>
                  <span className="mc-chip">{PROJECT_STATUS[p.status]}</span>
                </div>
                <p className="muted" style={{ fontSize: 13, minHeight: 40 }}>{p.description || "No description yet."}</p>
                <div className="mc-card__foot spread">
                  <div className="row" style={{ gap: 4 }}>
                    {members.slice(0, 5).map((m) => <Face key={m!.id} person={m!} size={28} />)}
                    {members.length > 5 && <span className="faint" style={{ fontSize: 12 }}>+{members.length - 5}</span>}
                  </div>
                  <div className="row"><span className="mc-data">{comps.length} parts · {active.length} active</span>{comps.length > 0 && <State health={health} />}</div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
