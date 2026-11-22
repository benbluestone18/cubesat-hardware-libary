import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, getLibrary } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/status";
import type { Comment, ComponentLink, FileRow, Update } from "@/lib/types";
import { ago, shortDate, weekStart } from "@/lib/week";
import { addComment, addEditor, deleteComment, handOff, removeEditor, setStatus } from "@/app/actions/components";
import { addLink, removeLink, trashFile } from "@/app/actions/files";
import { UpdateEntry } from "@/components/cards";
import { Face, HealthState, Track, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ConfirmButton } from "@/components/client";
import { FileUpload } from "@/components/forms";
import { Flash, PageTitle, type SP } from "@/components/flash";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const lib = await getLibrary();
  return { title: lib.components.find((c) => c.id === id)?.name ?? "Component" };
}

function size(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ComponentPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const lib = await getLibrary();
  const c = lib.components.find((x) => x.id === id);
  if (!c) notFound();

  const supabase = await createClient();
  const [{ data: ed }, { data: files }, { data: updates }, { data: comments }, { data: linkRows }] = await Promise.all([
    supabase.from("component_editors").select("person_id").eq("component_id", id),
    supabase.from("files").select("*").eq("component_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("updates").select("*").eq("component_id", id).order("week_start", { ascending: false }).limit(52),
    supabase.from("comments").select("*").eq("component_id", id).order("created_at"),
    supabase.from("component_links").select("*").eq("component_id", id).order("created_at"),
  ]);
  const editorIds = (ed ?? []).map((e) => e.person_id as string);
  const editors = editorIds.map((e) => lib.person.get(e)).filter(Boolean);
  const owner = lib.person.get(c.owner_id);
  const mayEdit = canEdit(lib.me, c, editorIds);
  const links = (linkRows ?? []) as ComponentLink[];
  const isOwner = lib.me.role === "admin" || c.owner_id === lib.me.id;
  const ups = (updates ?? []) as Update[];
  const thisWeek = weekStart();
  const postedThisWeek = ups.some((u) => u.week_start === thisWeek);
  const byRev = new Map<string, FileRow[]>();
  for (const f of (files ?? []) as FileRow[]) byRev.set(f.revision, [...(byRev.get(f.revision) ?? []), f]);
  const others = lib.people.filter((p) => p.id !== c.owner_id && !editorIds.includes(p.id));
  const project = lib.project.get(c.project_id)!;

  return (
    <>
      <PageTitle
        eyebrow={lib.path(c).split(" / ").map((part, i) => <span key={i} className="row" style={{ gap: 6 }}>{i === 0 ? <Link href={`/projects/${project.id}`}>{part}</Link> : <span>{part}</span>}<span>/</span></span>)}
        title={c.name}
        sub={c.description || undefined}
      >
        {c.onshape_url && <a className="mc-btn mc-btn--secondary" href={c.onshape_url} target="_blank" rel="noreferrer"><Icon name="external" /> Onshape</a>}
        {mayEdit && <Link className="mc-btn mc-btn--secondary" href={`/components/${id}/edit`}><Icon name="edit" /> Edit</Link>}
        {mayEdit && <Link className="mc-btn mc-btn--primary" href={`/updates/new?component=${id}`}><Icon name="plus" /> {postedThisWeek ? "Edit this week's update" : "Post update"}</Link>}
      </PageTitle>
      <Flash sp={sp} />

      <div className="mc-split">
        <div className="stack">
          <section className="mc-panel mc-glass" data-reveal>
            <div className="mc-cc__well" style={{ margin: 0 }}>
              <Track status={c.status} health={c.health.health} />
              <div className="mc-cc__row"><span className="mc-cc__state"><HealthState h={c.health} /></span><span className="mc-label">REV {c.revision.toUpperCase()} · {c.last_update_at ? `updated ${ago(c.last_update_at)}` : "no updates yet"}</span></div>
            </div>
            {mayEdit && (
              <form action={setStatus} className="row">
                <input type="hidden" name="id" value={id} />
                <span className="muted" style={{ fontSize: 13 }}>Move to</span>
                {STATUS_ORDER.filter((s) => s !== c.status).map((s) => <button key={s} className="mc-btn mc-btn--secondary mc-btn--sm" name="status" value={s} type="submit">{STATUS_LABEL[s]}</button>)}
              </form>
            )}
          </section>

          <section className="mc-panel mc-glass">
            <div className="mc-panel__head"><h2>Weekly updates</h2><span className="mc-label">{ups.length}</span></div>
            {ups.length === 0
              ? <Empty action={mayEdit ? <Link className="mc-btn mc-btn--primary mc-btn--sm" href={`/updates/new?component=${id}`}>Post the first update</Link> : undefined}>No updates yet.</Empty>
              : <div style={{ paddingTop: 8 }}>{ups.map((u, i) => <UpdateEntry key={u.id} u={u} author={lib.person.get(u.author_id)} component={c} path={c.name} last={i === ups.length - 1} />)}</div>}
          </section>

          <section className="mc-panel mc-glass" id="comments">
            <div className="mc-panel__head"><h2>Comments</h2><span className="mc-label">{comments?.length ?? 0}</span></div>
            {((comments ?? []) as Comment[]).map((m) => {
              const who = lib.person.get(m.author_id);
              return (
                <div className="comment" key={m.id}>
                  {who ? <Face person={who} size={32} /> : <span />}
                  <div>
                    <div className="comment__head">
                      <b>{who?.name ?? "Someone"}</b><span className="faint" style={{ fontSize: 12 }}>{shortDate(m.created_at)}</span>
                      {(m.author_id === lib.me.id || lib.me.role === "admin") && (
                        <form action={deleteComment} style={{ marginLeft: "auto" }}>
                          <input type="hidden" name="id" value={m.id} /><input type="hidden" name="component_id" value={id} />
                          <ConfirmButton className="mc-btn mc-btn--ghost mc-btn--sm" confirmLabel="Delete">Delete</ConfirmButton>
                        </form>
                      )}
                    </div>
                    <p className="comment__body">{m.body}</p>
                  </div>
                </div>
              );
            })}
            <form action={addComment} className="stack-sm">
              <input type="hidden" name="component_id" value={id} />
              <textarea className="textarea" name="body" required maxLength={4000} placeholder="Ask a question or leave a note. Anyone on the team can comment." aria-label="Comment" />
              <div className="form-actions"><button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Comment</button></div>
            </form>
          </section>
        </div>

        <div className="stack">
          <section className="mc-panel mc-glass">
            <div className="mc-panel__head"><h2>Details</h2></div>
            <dl className="kv">
              <dt>Owner</dt><dd>{owner ? <span className="row"><Face person={owner} size={24} /><Link className="link" href={`/people/${owner.id}`}>{owner.name}</Link></span> : "No one"}</dd>
              <dt>Editors</dt><dd>{editors.length ? editors.map((e) => e!.name).join(", ") : <span className="faint">Only the owner</span>}</dd>
              <dt>Status</dt><dd>{STATUS_LABEL[c.status]}</dd>
              <dt>Revision</dt><dd className="mc-data">{c.revision.toUpperCase()}</dd>
              <dt>Created</dt><dd>{shortDate(c.created_at)}</dd>
              <dt>Last change</dt><dd>{shortDate(c.updated_at)}</dd>
            </dl>
          </section>

          <section className="mc-panel mc-glass">
            <div className="mc-panel__head"><h2>Files</h2><span className="mc-label">{files?.length ?? 0}</span></div>
            {byRev.size === 0 && <p className="muted" style={{ fontSize: 13 }}>No files yet.</p>}
            {[...byRev.entries()].map(([rev, list]) => (
              <div key={rev} className="stack-sm" style={{ gap: 4 }}>
                <span className="mc-label">REV {rev.toUpperCase()}</span>
                {list.map((f) => (
                  <div key={f.id} className="spread" style={{ gap: 8 }}>
                    <a className="link row" href={`/files/${f.id}`} style={{ minWidth: 0, gap: 6 }}><Icon name="download" /><span style={{ overflowWrap: "anywhere" }}>{f.filename}</span></a>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="faint" style={{ fontSize: 12 }}>{size(f.size_bytes)} · {lib.person.get(f.uploaded_by)?.name.split(" ")[0]} · {shortDate(f.created_at)}</span>
                      {mayEdit && (
                        <form action={trashFile}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="component_id" value={id} /><ConfirmButton className="mc-icon-btn mc-icon-btn--sm" confirmLabel="Trash file"><Icon name="trash" /></ConfirmButton></form>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {mayEdit && <FileUpload componentId={id} revision={c.revision} />}
          </section>

          <section className="mc-panel mc-glass">
            <div className="mc-panel__head"><h2>Links</h2><span className="mc-label">{links.length}</span></div>
            {links.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Google Drive files, folders, Docs and Sheets, or any other page about this part.</p>}
            {links.map((l) => (
              <div key={l.id} className="spread" style={{ gap: 8 }}>
                <a className="link row" href={l.url} target="_blank" rel="noreferrer noopener" style={{ minWidth: 0, gap: 6 }}><Icon name="external" /><span style={{ overflowWrap: "anywhere" }}>{l.label}</span></a>
                <span className="row" style={{ gap: 6 }}>
                  <span className="faint" style={{ fontSize: 12 }}>{lib.person.get(l.added_by)?.name.split(" ")[0]} · {shortDate(l.created_at)}</span>
                  {mayEdit && (
                    <form action={removeLink}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="component_id" value={id} /><ConfirmButton className="mc-icon-btn mc-icon-btn--sm" confirmLabel="Remove link"><Icon name="trash" /></ConfirmButton></form>
                  )}
                </span>
              </div>
            ))}
            {mayEdit && (
              <form action={addLink} className="stack-sm">
                <input type="hidden" name="component_id" value={id} />
                <input className="input" name="url" type="url" required maxLength={2000} placeholder="https://drive.google.com/…" aria-label="Link" />
                <div className="row">
                  <input className="input input--inline" name="label" maxLength={120} placeholder="Name (optional)" aria-label="Link name" style={{ flex: 1 }} />
                  <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Add link</button>
                </div>
                <small className="faint">In Drive, use Share, then Copy link. Teammates need access to the file in Drive to open it.</small>
              </form>
            )}
          </section>

          {isOwner && (
            <section className="mc-panel mc-glass">
              <div className="mc-panel__head"><h2>Who can edit</h2></div>
              <p className="muted" style={{ fontSize: 13 }}>Editors can change details, post updates and upload files. Only the owner and the admin can add editors or hand the part off.</p>
              <div className="people-picker">
                {editors.map((e) => (
                  <form key={e!.id} action={removeEditor} className="chip-person">
                    <input type="hidden" name="component_id" value={id} /><input type="hidden" name="person_id" value={e!.id} />
                    <Face person={e!} size={24} link={false} />{e!.name}
                    <button type="submit" aria-label={`Remove ${e!.name}`}>×</button>
                  </form>
                ))}
              </div>
              {others.length > 0 && (
                <form action={addEditor} className="row">
                  <input type="hidden" name="component_id" value={id} />
                  <select className="select input--inline" name="person_id" required defaultValue="" aria-label="Add an editor">
                    <option value="" disabled>Add an editor</option>
                    {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit">Add</button>
                </form>
              )}
              <hr className="sep" />
              <form action={handOff} className="row">
                <input type="hidden" name="component_id" value={id} />
                <select className="select input--inline" name="person_id" required defaultValue="" aria-label="New owner">
                  <option value="" disabled>Hand off to…</option>
                  {lib.people.filter((p) => p.id !== c.owner_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ConfirmButton confirmLabel="Yes, hand it off">Hand off</ConfirmButton>
              </form>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
