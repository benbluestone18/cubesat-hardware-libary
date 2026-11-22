import type { Metadata } from "next";
import Link from "next/link";
import { getLibrary } from "@/lib/data";
import { createComponent } from "@/app/actions/components";
import { ComponentFields } from "@/components/component-fields";
import { Empty } from "@/components/ui";
import { Flash, PageTitle, one, type SP } from "@/components/flash";

export const metadata: Metadata = { title: "New component" };

export default async function NewComponent({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const lib = await getLibrary();
  const projectId = one(sp.project);
  const project = projectId ? lib.project.get(projectId) : undefined;

  if (lib.projects.length === 0) {
    return <><PageTitle title="New component" /><Empty action={<Link className="mc-btn mc-btn--primary mc-btn--sm" href="/projects">Create a project</Link>}>Components live in a project. Make one first.</Empty></>;
  }

  if (!project) {
    return (
      <>
        <PageTitle title="New component" sub="Which project is it part of?" />
        <Flash sp={sp} />
        <form method="get" className="form mc-panel mc-glass">
          <label className="field"><span>Project</span>
            <select className="select" name="project" required defaultValue="">
              <option value="" disabled>Pick a project</option>
              {lib.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="form-actions"><button className="mc-btn mc-btn--primary" type="submit">Next</button></div>
        </form>
      </>
    );
  }

  return (
    <>
      <PageTitle eyebrow={<><Link href={`/projects/${project.id}`}>{project.name}</Link><span>/</span><Link href="/components/new">change project</Link></>} title="New component" sub="You'll be the owner. Only you, people you add as editors, and the admin can change it. Anyone can comment." />
      <Flash sp={sp} />
      <form action={createComponent} className="form mc-panel mc-glass">
        <input type="hidden" name="project_id" value={project.id} />
        <ComponentFields lib={lib} projectId={project.id} folderId={one(sp.folder)} />
        <div className="form-actions">
          <button className="mc-btn mc-btn--primary" type="submit">Create component</button>
          <Link className="mc-btn mc-btn--ghost" href={`/projects/${project.id}`}>Cancel</Link>
        </div>
      </form>
    </>
  );
}
