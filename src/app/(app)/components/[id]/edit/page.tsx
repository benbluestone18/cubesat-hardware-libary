import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, canManagePart, getLibrary, getMemberships } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { trashComponent, updateComponent } from "@/app/actions/components";
import { ComponentFields } from "@/components/component-fields";
import { ConfirmButton } from "@/components/client";
import { Flash, PageTitle, type SP } from "@/components/flash";

export const metadata: Metadata = { title: "Edit part" };

export default async function EditComponent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const [lib, memberships] = await Promise.all([getLibrary(), getMemberships()]);
  const c = lib.components.find((x) => x.id === id);
  if (!c) notFound();
  const supabase = await createClient();
  const { data: ed } = await supabase.from("component_editors").select("person_id").eq("component_id", id);
  const editorIds = (ed ?? []).map((e) => e.person_id as string);
  const mayEdit = canEdit(lib.me, c, editorIds, memberships);
  const isOwner = canManagePart(lib.me, c, memberships);

  return (
    <>
      <PageTitle eyebrow={<><Link href={`/components/${id}`}>{c.name}</Link><span>/</span></>} title="Edit part" />
      <Flash sp={sp} />
      {!mayEdit ? (
        <p className="notice notice--warn">Only {lib.person.get(c.owner_id)?.name ?? "the owner"}, their editors, the team&apos;s leads and admins can change this part. You can still leave a comment.</p>
      ) : (
        <form action={updateComponent} className="form mc-panel mc-glass">
          <input type="hidden" name="id" value={id} />
          <ComponentFields lib={lib} projectId={c.project_id} c={c} />
          <div className="form-actions">
            <button className="mc-btn mc-btn--primary" type="submit">Save</button>
            <Link className="mc-btn mc-btn--ghost" href={`/components/${id}`}>Cancel</Link>
          </div>
        </form>
      )}
      {isOwner && (
        <form action={trashComponent} className="mc-panel mc-glass form">
          <input type="hidden" name="id" value={id} />
          <p className="muted" style={{ fontSize: 13 }}>Trashing hides the part, its files and its updates. The team&apos;s leads and admins can bring it back from the trash.</p>
          <div><ConfirmButton confirmLabel={`Yes, trash ${c.name}`}>Move to trash</ConfirmButton></div>
        </form>
      )}
    </>
  );
}
