import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canManageTeam, getLibrary, getMemberships, type ComponentWithHealth, type Library } from "@/lib/data";
import { STATUS_LABEL, STATUS_ORDER, byUrgency, type ComponentStatus, type Health } from "@/lib/status";
import type { Folder } from "@/lib/types";
import { addMember, createFolder, joinProject, leaveProject, removeMember, setLead, renameFolder, trashFolder, trashProject, updateProject } from "@/app/actions/projects";
import { Face, Empty } from "@/components/ui";
import { Icon, StatusIcon } from "@/components/icons";
import { ConfirmButton } from "@/components/client";
import { Flash, PageTitle, one, type SP } from "@/components/flash";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const lib = await getLibrary();
  return { title: lib.project.get((await params).id)?.name ?? "Project" };
}

const COLUMNS: { key: string; title: string; health: Health; statuses: ComponentStatus[] }[] = [
  { key: "planned", title: "Planned", health: "planned", statuses: ["planned"] },
  { key: "design", title: "In design", health: "working", statuses: ["in_design"] },
  { key: "review", title: "In review", health: "working", statuses: ["in_review"] },
  { key: "done", title: "Released or built", health: "done", statuses: ["released", "built"] },
  { key: "hold", title: "On hold", health: "warn", statuses: ["on_hold"] },
];

function descendants(folders: Folder[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) { grew = false; for (const f of folders) if (f.parent_id && out.has(f.parent_id) && !out.has(f.id)) { out.add(f.id); grew = true; } }
  return out;
}

function Task({ c, lib }: { c: ComponentWithHealth; lib: Library }) {
  const owner = lib.person.get(c.owner_id);
  const folder = c.folder_id ? lib.folderPath(c.project_id, c.folder_id) : "";
  return (
    <Link className={`mc-task${c.health.health === "stalled" ? " mc-task--stalled" : ""}`} href={`/components/${c.id}`}>
      {owner ? <Face person={owner} size={32} link={false} /> : <span />}
      <span className="mc-task__t"><b>{c.name}</b>{folder || owner?.name}</span>
      <span className="mc-task__end" title={c.health.reason}><StatusIcon health={c.health.health} /></span>
    </Link>
  );
}

function Tree({ parent, folders, comps, lib, projectId, all }: { parent: string | null; folders: Folder[]; comps: ComponentWithHealth[]; lib: Library; projectId: string; all: Folder[] }) {
  const here = folders.filter((f) => f.parent_id === parent);
  const items = comps.filter((c) => c.folder_id === parent);
  if (here.length === 0 && items.length === 0) return null;
  return (
    <ul className="tree">
      {here.map((f) => {
        const blocked = descendants(all, f.id);
        return (
          <li key={f.id}>
            <div className="tree__row">
              <Icon name="folder" />
              <span className="tree__name">{f.name}</span>
              <span className="tree__tools">
                <Link className="mc-btn mc-btn--ghost mc-btn--sm" href={`/components/new?project=${projectId}&folder=${f.id}`}>Add part</Link>
                <details className="inline">
                  <summary className="mc-btn mc-btn--ghost mc-btn--sm">Folder</summary>
                  <div className="mc-panel mc-glass popover">
                    <form action={createFolder} className="row">
                      <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="parent_id" value={f.id} />
                      <input className="input input--inline" name="name" required maxLength={80} placeholder="Subfolder name" aria-label="Subfolder name" />
                      <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Add subfolder</button>
                    </form>
                    <form action={renameFolder} className="row">
                      <input type="hidden" name="id" value={f.id} /><input type="hidden" name="project_id" value={projectId} />
                      <input className="input input--inline" name="name" defaultValue={f.name} maxLength={80} aria-label="Folder name" />
                      <select className="select input--inline" name="parent_id" defaultValue={f.parent_id ?? ""} aria-label="Move into">
                        <option value="">Top level</option>
                        {all.filter((o) => !blocked.has(o.id)).map((o) => <option key={o.id} value={o.id}>{lib.folderPath(projectId, o.id)}</option>)}
                      </select>
                      <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Rename or move</button>
                    </form>
                    <form action={trashFolder} className="row">
                      <input type="hidden" name="id" value={f.id} /><input type="hidden" name="project_id" value={projectId} />
                      <ConfirmButton confirmLabel="Yes, move to trash">Trash folder</ConfirmButton>
                    </form>
                  </div>
                </details>
              </span>
            </div>
            <Tree parent={f.id} folders={folders} comps={comps} lib={lib} projectId={projectId} all={all} />
          </li>
        );
      })}
      {items.map((c) => {
        const owner = lib.person.get(c.owner_id);
        return (
          <li key={c.id}>
            <div className="tree__row">
              <Link className="tree__comp" href={`/components/${c.id}`}>
                <StatusIcon health={c.health.health} />
                <b>{c.name}</b>
                <span className="faint" style={{ fontSize: 12 }}>{STATUS_LABEL[c.status]} · REV {c.revision.toUpperCase()}</span>
              </Link>
              {owner && <Face person={owner} size={24} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function ProjectPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const [lib, memberships] = await Promise.all([getLibrary(), getMemberships()]);
  const project = lib.project.get(id);
  if (!project) notFound();

  const ownerFilter = one(sp.owner) ?? "";
  const statusFilter = one(sp.status) ?? "";
  const all = lib.components.filter((c) => c.project_id === id);
  const comps = all.filter((c) => (!ownerFilter || c.owner_id === ownerFilter) && (!statusFilter || c.status === statusFilter));
  const folders = lib.folders.filter((f) => f.project_id === id);
  const rows = memberships.filter((m) => m.project_id === id);
  const leads = new Set(rows.filter((m) => m.lead).map((m) => m.person_id));
  const members = rows.map((m) => lib.person.get(m.person_id)!).filter(Boolean)
    .sort((a, b) => Number(leads.has(b.id)) - Number(leads.has(a.id)) || a.name.localeCompare(b.name));
  const isMember = members.some((m) => m.id === lib.me.id);
  const manage = canManageTeam(lib.me, id, memberships);
  const others = lib.people.filter((p) => !members.some((m) => m.id === p.id));
  const owners = [...new Set(all.map((c) => c.owner_id))].map((o) => lib.person.get(o)).filter(Boolean);
  const columns = COLUMNS.filter((col) => col.key !== "hold" || comps.some((c) => c.status === "on_hold"));

  return (
    <>
      <PageTitle eyebrow={<><Link href="/projects">Projects</Link><span>/</span></>} title={project.name} sub={project.description || undefined}>
        <form action={isMember ? leaveProject : joinProject}>
          <input type="hidden" name="project_id" value={id} />
          <button className="mc-btn mc-btn--secondary" type="submit">{isMember ? "Leave project" : "Join project"}</button>
        </form>
        <Link className="mc-btn mc-btn--primary" href={`/components/new?project=${id}`}><Icon name="plus" /> New component</Link>
      </PageTitle>
      <Flash sp={sp} />

      <section className="mc-panel mc-glass">
        <div className="mc-panel__head">
          <h2>Board</h2>
          <form className="row" method="get">
            <select className="select input--inline" name="owner" defaultValue={ownerFilter} aria-label="Owner">
              <option value="">Everyone</option>
              {owners.map((o) => <option key={o!.id} value={o!.id}>{o!.name}</option>)}
            </select>
            <select className="select input--inline" name="status" defaultValue={statusFilter} aria-label="Status">
              <option value="">Any status</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Filter</button>
            {(ownerFilter || statusFilter) && <Link className="mc-btn mc-btn--ghost mc-btn--sm" href={`/projects/${id}`}>Clear</Link>}
          </form>
        </div>
        {all.length === 0 ? (
          <Empty action={<Link className="mc-btn mc-btn--primary mc-btn--sm" href={`/components/new?project=${id}`}>Add the first component</Link>}>No components in {project.name} yet.</Empty>
        ) : (
          <div className="mc-board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))`, gap: 20, padding: 4 }}>
            {columns.map((col) => {
              const items = comps.filter((c) => col.statuses.includes(c.status)).sort(byUrgency);
              return (
                <div className="mc-col" key={col.key}>
                  <div className="mc-col__title"><StatusIcon health={col.health} />{col.title} · {items.length}</div>
                  <div className="mc-col__panel">
                    {items.length === 0 ? <p className="faint" style={{ fontSize: 12, padding: 8, textAlign: "center" }}>Nothing here</p> : items.map((c) => <Task key={c.id} c={c} lib={lib} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mc-split">
        <section className="mc-panel mc-glass">
          <div className="mc-panel__head">
            <h2>Library</h2>
            <details className="inline">
              <summary className="mc-btn mc-btn--secondary mc-btn--sm"><Icon name="plus" /> Folder</summary>
              <form action={createFolder} className="row mc-panel mc-glass popover">
                <input type="hidden" name="project_id" value={id} />
                <input className="input input--inline" name="name" required maxLength={80} placeholder="Folder name" aria-label="Folder name" />
                <button className="mc-btn mc-btn--primary mc-btn--sm" type="submit">Add folder</button>
              </form>
            </details>
          </div>
          {folders.length === 0 && comps.length === 0
            ? <p className="muted" style={{ fontSize: 13 }}>Folders group parts, like Magnetorquers or Sun sensors. They can nest.</p>
            : <Tree parent={null} folders={folders} comps={comps} lib={lib} projectId={id} all={folders} />}
        </section>

        <div className="stack">
          <section className="mc-panel mc-glass">
            <div className="mc-panel__head"><h2>Team</h2><span className="mc-label">{members.length}</span></div>
            {members.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No one is on this team yet.</p> : (
              <div className="stack-sm" style={{ gap: 2 }}>
                {members.map((m) => (
                  <div key={m.id} className="member-row">
                    <Link className="person-row" href={`/people/${m.id}`} style={{ gridTemplateColumns: "auto 1fr" }}>
                      <Face person={m} size={32} link={false} />
                      <div>
                        <div className="person-row__name">{m.name}{leads.has(m.id) && <span className="mc-chip" style={{ marginLeft: 8 }}>Lead</span>}</div>
                        <div className="person-row__meta">{((n) => `${n} ${n === 1 ? "part" : "parts"} here`)(all.filter((c) => c.owner_id === m.id).length)}</div>
                      </div>
                    </Link>
                    {manage && (
                      <details className="inline member-row__menu">
                        <summary className="mc-icon-btn mc-icon-btn--sm" aria-label={`Change ${m.name}'s place on the team`}><Icon name="chevron" /></summary>
                        <div className="mc-panel mc-glass popover stack-sm">
                          <form action={setLead}>
                            <input type="hidden" name="project_id" value={id} /><input type="hidden" name="person_id" value={m.id} />
                            <input type="hidden" name="lead" value={leads.has(m.id) ? "false" : "true"} />
                            <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">{leads.has(m.id) ? "Remove as lead" : "Make team lead"}</button>
                          </form>
                          <form action={removeMember}>
                            <input type="hidden" name="project_id" value={id} /><input type="hidden" name="person_id" value={m.id} />
                            <ConfirmButton className="mc-btn mc-btn--ghost mc-btn--sm" confirmLabel={`Yes, remove ${m.name.split(" ")[0]}`}>Remove from team</ConfirmButton>
                          </form>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
            {manage && others.length > 0 && (
              <form action={addMember} className="row" style={{ marginTop: 12 }}>
                <input type="hidden" name="project_id" value={id} />
                <select className="select input--inline" name="person_id" required defaultValue="" aria-label="Person to add" style={{ flex: 1, minWidth: 0 }}>
                  <option value="" disabled>Add someone…</option>
                  {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Add</button>
              </form>
            )}
            <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
              {manage ? "As " + (lib.me.role === "admin" ? "an admin" : "a team lead") + ", you can add people, remove them and choose leads. Anyone can join or leave on their own."
                : "Team leads and admins can add people. You can join or leave on your own with the button at the top."}
            </p>
          </section>
          <section className="mc-panel mc-glass">
            <details className="inline">
              <summary className="spread"><h2 style={{ fontSize: 16 }}>Project settings</h2><Icon name="chevron" /></summary>
              <form action={updateProject} className="form">
                <input type="hidden" name="id" value={id} />
                <label className="field"><span>Name</span><input className="input" name="name" defaultValue={project.name} required maxLength={80} /></label>
                <label className="field"><span>What it covers</span><textarea className="textarea" name="description" defaultValue={project.description} maxLength={2000} /></label>
                <label className="field"><span>Status</span>
                  <select className="select" name="status" defaultValue={project.status}><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></select>
                  <small>Done projects drop out of the top bar but stay searchable.</small>
                </label>
                <div className="form-actions"><button className="mc-btn mc-btn--primary" type="submit">Save</button></div>
              </form>
              <hr className="sep" style={{ margin: "16px 0" }} />
              <form action={trashProject}>
                <input type="hidden" name="id" value={id} />
                <ConfirmButton confirmLabel={`Yes, trash ${project.name}`}>Move project to trash</ConfirmButton>
              </form>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
