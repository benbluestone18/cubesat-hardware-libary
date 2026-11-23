import type { Metadata } from "next";
import Link from "next/link";
import { getLibrary, getMemberships, getMission } from "@/lib/data";
import { grams, sumBudget, watts } from "@/lib/budget";
import { worst } from "@/lib/status";
import { createProject, setMissionLimits } from "@/app/actions/projects";
import { BudgetBar, Face, State, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Flash, PageTitle, type SP } from "@/components/flash";

export const metadata: Metadata = { title: "Projects" };

const PROJECT_STATUS = { active: "Active", paused: "Paused", done: "Done" } as const;

export default async function Projects({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [lib, memberships, mission] = await Promise.all([getLibrary(), getMemberships(), getMission()]);
  const total = sumBudget(lib.components);
  const rows = lib.projects.map((p) => ({ p, b: sumBudget(lib.components.filter((c) => c.project_id === p.id)) }));
  const allocated = { mass: rows.reduce((n, r) => n + Number(r.p.mass_budget_g ?? 0), 0), power: rows.reduce((n, r) => n + Number(r.p.power_budget_w ?? 0), 0) };
  const isAdmin = lib.me.role === "admin";
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

      {lib.projects.length > 0 && (
        <section className="mc-panel mc-glass" id="budget">
          <div className="mc-panel__head"><h2>Mass and power budget</h2><span className="mc-label">Whole satellite</span></div>
          <div className="budget-grid">
            <div>
              <small>Total mass</small>
              <b className={mission.mass_limit_g && total.mass > Number(mission.mass_limit_g) ? "over" : undefined}>{grams(total.mass)}</b>
              <small>{mission.mass_limit_g ? `of ${grams(mission.mass_limit_g)} limit` : "No limit set"} · {total.withMass} of {total.parts} parts weighed</small>
              <BudgetBar used={total.mass} limit={mission.mass_limit_g} label="Satellite mass" />
            </div>
            <div>
              <small>Total power draw</small>
              <b className={mission.power_limit_w && total.power > Number(mission.power_limit_w) ? "over" : undefined}>{watts(total.power)}</b>
              <small>{mission.power_limit_w ? `of ${watts(mission.power_limit_w)} limit` : "No limit set"} · {total.withPower} of {total.parts} parts measured</small>
              <BudgetBar used={total.power} limit={mission.power_limit_w} label="Satellite power" />
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Team</th><th>Mass</th><th>Mass budget</th><th>Power</th><th>Power budget</th></tr></thead>
              <tbody>
                {rows.map(({ p, b }) => (
                  <tr key={p.id}>
                    <td><Link className="link" href={`/projects/${p.id}`}>{p.name}</Link></td>
                    <td className={`mc-data${p.mass_budget_g && b.mass > Number(p.mass_budget_g) ? " over" : ""}`}>{grams(b.mass)}</td>
                    <td className="mc-data muted">{grams(p.mass_budget_g)}</td>
                    <td className={`mc-data${p.power_budget_w && b.power > Number(p.power_budget_w) ? " over" : ""}`}>{watts(b.power)}</td>
                    <td className="mc-data muted">{watts(p.power_budget_w)}</td>
                  </tr>
                ))}
                <tr>
                  <td><b>Allocated to teams</b></td><td /><td className={`mc-data${mission.mass_limit_g && allocated.mass > Number(mission.mass_limit_g) ? " over" : ""}`}>{allocated.mass ? grams(allocated.mass) : "—"}</td>
                  <td /><td className={`mc-data${mission.power_limit_w && allocated.power > Number(mission.power_limit_w) ? " over" : ""}`}>{allocated.power ? watts(allocated.power) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: 12 }}>Totals count only parts with a value. Each team sets its own budget in its Project settings.</p>
          {isAdmin && (
            <form action={setMissionLimits} className="row" style={{ alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <label className="field" style={{ flex: 1, minWidth: 140 }}><span>Satellite mass limit (g)</span><input className="input" name="mass_limit_g" type="number" min={0} step="any" defaultValue={mission.mass_limit_g ?? ""} placeholder="Optional" /></label>
              <label className="field" style={{ flex: 1, minWidth: 140 }}><span>Satellite power limit (W)</span><input className="input" name="power_limit_w" type="number" min={0} step="any" defaultValue={mission.power_limit_w ?? ""} placeholder="Optional" /></label>
              <button className="mc-btn mc-btn--secondary" type="submit">Save limits</button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
