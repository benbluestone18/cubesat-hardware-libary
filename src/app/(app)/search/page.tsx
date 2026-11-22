import type { Metadata } from "next";
import Link from "next/link";
import { getLibrary } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/ui";
import { PageTitle, one, type SP } from "@/components/flash";

export const metadata: Metadata = { title: "Search" };

type Hit = { kind: string; id: string; title: string; subtitle: string | null; component_id: string | null };

const KIND: Record<string, string> = { project: "Project", folder: "Folder", component: "Component", person: "Person", update: "Update", comment: "Comment" };

export default async function Search({ searchParams }: { searchParams: SP }) {
  const q = (one((await searchParams).q) ?? "").trim().slice(0, 100);
  const lib = await getLibrary();
  let hits: Hit[] = [];
  if (q.length >= 2) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("search_library", { q });
    hits = (data ?? []) as Hit[];
  }
  const href = (h: Hit) => {
    if (h.kind === "project") return `/projects/${h.id}`;
    if (h.kind === "person") return `/people/${h.id}`;
    if (h.kind === "folder") return `/projects/${lib.folder.get(h.id)?.project_id ?? ""}`;
    if (h.kind === "comment") return `/components/${h.component_id}#comments`;
    return `/components/${h.component_id ?? h.id}`;
  };
  // People's emails are shown to members only, but there's no need to show them here.
  const sub = (h: Hit) => (h.kind === "person" ? lib.person.get(h.id)?.role === "admin" ? "Admin" : "Team member" : h.subtitle);
  return (
    <>
      <PageTitle title="Search" sub="Parts, projects, folders, people, updates and comments." />
      <form className="search-box" method="get" role="search">
        <input className="input" type="search" name="q" defaultValue={q} placeholder="Try “magnetorquer” or “PCB rev B”" aria-label="Search the library" autoFocus />
        <button className="mc-btn mc-btn--primary" type="submit" style={{ height: 46 }}>Search</button>
      </form>
      {q.length === 1 && <p className="muted">Type at least 2 letters.</p>}
      {q.length >= 2 && (hits.length === 0 ? <Empty>Nothing matches “{q}”.</Empty> : (
        <section className="mc-panel mc-glass" aria-label={`${hits.length} results`}>
          <span className="mc-label">{hits.length === 50 ? "First 50 results" : `${hits.length} results`}</span>
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
