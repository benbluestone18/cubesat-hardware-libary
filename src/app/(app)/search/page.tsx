import type { Metadata } from "next";
import Link from "next/link";
import { getLibrary } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/ui";
import { PageTitle, one, type SP } from "@/components/flash";

export const metadata: Metadata = { title: "Search" };

type Hit = { kind: string; id: string; title: string; subtitle: string | null; component_id: string | null };

const KIND: Record<string, string> = { project: "Project", folder: "Folder", component: "Part", person: "Person", update: "Update", comment: "Comment", file: "File", link: "Link" };

export default async function Search({ searchParams }: { searchParams: SP }) {
  const q = (one((await searchParams).q) ?? "").trim().slice(0, 100);
  const lib = await getLibrary();
  let hits: Hit[] = [];
  if (q.length >= 2) {
    const supabase = await createClient();
    // Files and links are searched here, next to the database search, so no database change was needed.
    const like = `%${q.replace(/[\\%_]/g, (ch) => "\\" + ch)}%`;
    const [{ data }, { data: files }, { data: byLabel }, { data: byUrl }] = await Promise.all([
      supabase.rpc("search_library", { q }),
      supabase.from("files").select("id, filename, revision, component_id").is("deleted_at", null).ilike("filename", like).limit(25),
      supabase.from("component_links").select("id, label, url, component_id").ilike("label", like).limit(25),
      supabase.from("component_links").select("id, label, url, component_id").ilike("url", like).limit(25),
    ]);
    const part = (id: string) => lib.components.find((c) => c.id === id);
    const fileHits: Hit[] = (files ?? []).filter((f) => part(f.component_id)).map((f) => ({ kind: "file", id: f.id, title: f.filename, subtitle: `${part(f.component_id)!.name} · REV ${String(f.revision).toUpperCase()}`, component_id: f.component_id }));
    const seen = new Set<string>();
    const linkHits: Hit[] = [...(byLabel ?? []), ...(byUrl ?? [])].filter((l) => part(l.component_id) && !seen.has(l.id) && seen.add(l.id))
      .map((l) => ({ kind: "link", id: l.id, title: l.label, subtitle: `${part(l.component_id)!.name} · ${l.url}`, component_id: l.component_id }));
    hits = [...((data ?? []) as Hit[]), ...fileHits, ...linkHits];
  }
  const href = (h: Hit) => {
    if (h.kind === "project") return `/projects/${h.id}`;
    if (h.kind === "person") return `/people/${h.id}`;
    if (h.kind === "folder") return `/projects/${lib.folder.get(h.id)?.project_id ?? ""}`;
    if (h.kind === "comment") return `/components/${h.component_id}#comments`;
    if (h.kind === "link") return `/components/${h.component_id}#links`;
    return `/components/${h.component_id ?? h.id}`;
  };
  // People's emails are shown to members only, but there's no need to show them here.
  const sub = (h: Hit) => (h.kind === "person" ? lib.person.get(h.id)?.role === "admin" ? "Admin" : "Team member" : h.subtitle);
  return (
    <>
      <PageTitle title="Search" sub="Parts, projects, folders, people, updates, comments, files and links." />
      <form className="search-box" method="get" role="search">
        <input className="input" type="search" name="q" defaultValue={q} placeholder="Try “magnetorquer” or “PCB rev B”" aria-label="Search the library" autoFocus />
        <button className="mc-btn mc-btn--primary" type="submit" style={{ height: 46 }}>Search</button>
      </form>
      {q.length === 1 && <p className="muted">Type at least 2 letters.</p>}
      {q.length >= 2 && (hits.length === 0 ? <Empty>Nothing matches “{q}”.</Empty> : (
        <section className="mc-panel mc-glass" aria-label={`${hits.length} ${hits.length === 1 ? "result" : "results"}`}>
          <span className="mc-label">{hits.length >= 50 ? `First ${hits.length} results` : `${hits.length} ${hits.length === 1 ? "result" : "results"}`}</span>
          {hits.map((h) => (
            <Link key={`${h.kind}-${h.id}`} className="result" href={href(h)}>
              <span className="result__kind">{KIND[h.kind] ?? h.kind}</span>
              <span style={{ minWidth: 0 }}><span className="result__title">{h.title}</span>{sub(h) && <span className="result__sub" style={{ display: "-webkit-box" }}>{sub(h)}</span>}</span>
            </Link>
          ))}
        </section>
      ))}
    </>
  );
}
