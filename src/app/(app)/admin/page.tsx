import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLibrary } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { dateTime, shortDate } from "@/lib/week";
import { setRole } from "@/app/actions/people";
import { restoreItem } from "@/app/actions/projects";
import { Face } from "@/components/ui";
import { Flash, PageTitle, type SP } from "@/components/flash";

export const metadata: Metadata = { title: "Admin" };

type Trashed = { table: string; id: string; name: string; deleted_at: string; where: string };
type Log = { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; detail: { label?: string; old_name?: string; changed?: string[]; person_id?: string; project_id?: string; component_id?: string }; created_at: string };

/** Database table names, in the words the team uses. */
const THING: Record<string, string> = {
  projects: "project", folders: "folder", components: "part", component_editors: "editor", updates: "weekly update",
  files: "file", comments: "comment", weeks: "meeting notes", memberships: "team member", component_links: "link",
  people: "person", mission: "satellite limits",
};

/** Column names, in plain words. Columns that change together (resolved_at and resolved_by) say it once. */
const FIELD: Record<string, string> = {
  name: "name", description: "description", status: "status", revision: "revision", mass_g: "mass", power_w: "power",
  onshape_url: "Onshape link", folder_id: "folder", parent_id: "folder", owner_id: "owner", lead: "lead",
  mass_budget_g: "mass budget", power_budget_w: "power budget", mass_limit_g: "mass limit", power_limit_w: "power limit",
  resolved_at: "resolved", resolved_by: "resolved", is_issue: "issue", body: "text", done: "done", next: "next", blocked: "blocked",
  role: "role", deleted_at: "trash", label: "name", url: "link", slides_url: "slides", notes: "notes", filename: "file name",
};
const fields = (keys: string[]) => [...new Set(keys.map((k) => FIELD[k] ?? k.replace(/_/g, " ")))].join(", ");

export default async function Admin({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const lib = await getLibrary();
  if (lib.me.role !== "admin") notFound();
  const supabase = await createClient();
  const [pr, fo, co, fi, { data: log }] = await Promise.all([
    supabase.from("projects").select("id, name, deleted_at").not("deleted_at", "is", null),
    supabase.from("folders").select("id, name, project_id, deleted_at").not("deleted_at", "is", null),
    supabase.from("components").select("id, name, project_id, deleted_at").not("deleted_at", "is", null),
    supabase.from("files").select("id, filename, component_id, deleted_at, components(name, project_id, deleted_at)").not("deleted_at", "is", null),
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const projName = (id: string) => lib.project.get(id)?.name ?? "a trashed project";
  const trash: Trashed[] = [
    ...(pr.data ?? []).map((r) => ({ table: "projects", id: r.id, name: r.name, deleted_at: r.deleted_at, where: "Project" })),
    ...(fo.data ?? []).map((r) => ({ table: "folders", id: r.id, name: r.name, deleted_at: r.deleted_at, where: `Folder in ${projName(r.project_id)}` })),
    ...(co.data ?? []).map((r) => ({ table: "components", id: r.id, name: r.name, deleted_at: r.deleted_at, where: `Part in ${projName(r.project_id)}` })),
    ...(fi.data ?? []).map((r) => {
      const part = r.components as unknown as { name: string; project_id: string; deleted_at: string | null } | null;
      const note = !part ? "" : part.deleted_at ? " (part is in the trash)" : !lib.project.has(part.project_id) ? ` (in ${projName(part.project_id)})` : "";
      return { table: "files", id: r.id, name: r.filename, deleted_at: r.deleted_at, where: `File on ${part?.name ?? "a deleted part"}${note}` };
    }),
  ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));

  return (
    <>
      <PageTitle title="Admin" sub="Roles, the trash, and a log of every change." />
      <Flash sp={sp} />
      <section className="mc-panel mc-glass">
        <div className="mc-panel__head"><h2>People and roles</h2></div>
        <p className="muted" style={{ fontSize: 13 }}>Admins can edit any part, restore from the trash, and change roles. Keep at least two admins so the team is never locked out.</p>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Role</th></tr></thead>
          <tbody>{lib.people.map((p) => (
            <tr key={p.id}>
              <td><span className="row"><Face person={p} size={28} />{p.name}</span></td>
              <td className="muted">{p.email}</td>
              <td className="muted">{shortDate(p.created_at)}</td>
              <td>
                <form action={setRole} className="row">
                  <input type="hidden" name="person_id" value={p.id} />
                  <select className="select input--inline" name="role" defaultValue={p.role} aria-label={`Role for ${p.name}`} style={{ minWidth: 120 }}><option value="member">Member</option><option value="admin">Admin</option></select>
                  <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Set</button>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>

      <section className="mc-panel mc-glass">
        <div className="mc-panel__head"><h2>Trash</h2><span className="mc-label">{trash.length}</span></div>
        {trash.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Empty.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Item</th><th>What</th><th>Trashed</th><th /></tr></thead>
            <tbody>{trash.map((t) => (
              <tr key={t.table + t.id}>
                <td>{t.name}</td><td className="muted">{t.where}</td><td className="muted">{shortDate(t.deleted_at)}</td>
                <td><form action={restoreItem}><input type="hidden" name="table" value={t.table} /><input type="hidden" name="id" value={t.id} /><button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Restore</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="mc-panel mc-glass">
        <div className="mc-panel__head"><h2>Activity</h2><span className="mc-label">Last 100</span></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>When</th><th>Who</th><th>Did</th><th>What</th></tr></thead>
          <tbody>{((log ?? []) as Log[]).map((l) => (
            <tr key={l.id}>
              <td className="muted" style={{ whiteSpace: "nowrap" }}>{dateTime(l.created_at)}</td>
              <td>{l.actor_id ? lib.person.get(l.actor_id)?.name ?? "Someone" : "System"}</td>
              <td>{l.action}{(() => { const c = (l.detail?.changed ?? []).filter((k) => k !== "deleted_at"); return c.length ? <span className="faint"> ({fields(c)})</span> : null; })()}</td>
              <td><LogWhat l={l} lib={lib} /> <span className="faint">{THING[l.entity] ?? l.entity}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
    </>
  );
}

/** What a log line is about, by name, linked when it still exists. */
function LogWhat({ l, lib }: { l: Log; lib: Awaited<ReturnType<typeof getLibrary>> }) {
  const d = l.detail ?? {};
  const part = (id?: string | null) => (id ? lib.components.find((c) => c.id === id) : undefined);
  if (l.entity === "memberships" || l.entity === "component_editors") {
    const who = d.person_id ? lib.person.get(d.person_id)?.name ?? "Someone" : "Someone";
    const where = d.project_id ? lib.project.get(d.project_id)?.name : part(d.component_id)?.name;
    return <>{who}{where ? <span className="faint"> on {where}</span> : null}</>;
  }
  if (l.entity === "updates") {
    const p = part(d.component_id);
    return <>{p ? <Link className="link" href={`/components/${p.id}`}>{p.name}</Link> : "A part"}{d.label ? <span className="faint">, week of {shortDate(d.label)}</span> : null}</>;
  }
  if (l.entity === "mission") return <>Whole satellite</>;
  if (l.entity === "people" && d.old_name) return <>{d.old_name} <span className="faint">to</span> {d.label}</>;
  const p = l.entity === "components" ? part(l.entity_id) : ["files", "comments", "component_links"].includes(l.entity) ? part(d.component_id) : undefined;
  const label = d.label ?? (l.entity === "people" && l.entity_id ? lib.person.get(l.entity_id)?.name : undefined) ?? "";
  if (p && l.entity === "components") return <Link className="link" href={`/components/${p.id}`}>{label || p.name}</Link>;
  return <>{label}{p ? <span className="faint"> on <Link className="link" href={`/components/${p.id}`}>{p.name}</Link></span> : null}</>;
}
