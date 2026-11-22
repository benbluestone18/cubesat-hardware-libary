import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLibrary } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { shortDate } from "@/lib/week";
import { setRole } from "@/app/actions/people";
import { restoreItem } from "@/app/actions/projects";
import { Face } from "@/components/ui";
import { Flash, PageTitle, type SP } from "@/components/flash";

export const metadata: Metadata = { title: "Admin" };

type Trashed = { table: string; id: string; name: string; deleted_at: string; where: string };
type Log = { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; detail: { label?: string; changed?: string[] }; created_at: string };

export default async function Admin({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const lib = await getLibrary();
  if (lib.me.role !== "admin") notFound();
  const supabase = await createClient();
  const [pr, fo, co, fi, { data: log }] = await Promise.all([
    supabase.from("projects").select("id, name, deleted_at").not("deleted_at", "is", null),
    supabase.from("folders").select("id, name, project_id, deleted_at").not("deleted_at", "is", null),
    supabase.from("components").select("id, name, project_id, deleted_at").not("deleted_at", "is", null),
    supabase.from("files").select("id, filename, component_id, deleted_at").not("deleted_at", "is", null),
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const projName = (id: string) => lib.project.get(id)?.name ?? "a trashed project";
  const trash: Trashed[] = [
    ...(pr.data ?? []).map((r) => ({ table: "projects", id: r.id, name: r.name, deleted_at: r.deleted_at, where: "Project" })),
    ...(fo.data ?? []).map((r) => ({ table: "folders", id: r.id, name: r.name, deleted_at: r.deleted_at, where: `Folder in ${projName(r.project_id)}` })),
    ...(co.data ?? []).map((r) => ({ table: "components", id: r.id, name: r.name, deleted_at: r.deleted_at, where: `Component in ${projName(r.project_id)}` })),
    ...(fi.data ?? []).map((r) => ({ table: "files", id: r.id, name: r.filename, deleted_at: r.deleted_at, where: `File on ${lib.components.find((c) => c.id === r.component_id)?.name ?? "a trashed part"}` })),
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
              <td className="muted" style={{ whiteSpace: "nowrap" }}>{shortDate(l.created_at)}</td>
              <td>{l.actor_id ? lib.person.get(l.actor_id)?.name ?? "Someone" : "System"}</td>
              <td>{l.action}{l.detail?.changed?.length ? <span className="faint"> ({l.detail.changed.join(", ")})</span> : null}</td>
              <td>{l.entity === "components" && l.entity_id && lib.components.some((c) => c.id === l.entity_id) ? <Link className="link" href={`/components/${l.entity_id}`}>{l.detail?.label}</Link> : <>{l.detail?.label ?? l.entity}</>} <span className="faint">{l.entity.replace(/s$/, "")}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
    </>
  );
}
