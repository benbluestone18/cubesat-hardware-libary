"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back, explain, optional, str } from "./util";

async function uid() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, uid: data?.claims?.sub as string };
}

export async function createProject(form: FormData) {
  const { supabase, uid: me } = await uid();
  const name = str(form, "name", 80);
  if (!name) back("/projects", "Give the project a name");
  const { data, error } = await supabase.from("projects").insert({ name, description: str(form, "description", 2000), created_by: me }).select("id").single();
  if (error || !data) back("/projects", explain(error));
  await supabase.from("memberships").insert({ person_id: me, project_id: data.id, lead: true });
  revalidatePath("/", "layout");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(form: FormData) {
  const { supabase } = await uid();
  const id = str(form, "id");
  const status = str(form, "status");
  const { error } = await supabase.from("projects").update({
    name: str(form, "name", 80),
    description: str(form, "description", 2000),
    status: ["active", "paused", "done"].includes(status) ? status : "active",
  }).eq("id", id);
  if (error) back(`/projects/${id}`, explain(error));
  revalidatePath("/", "layout");
  back(`/projects/${id}`, "Project saved", "ok");
}

export async function trashProject(form: FormData) {
  const { supabase } = await uid();
  const id = str(form, "id");
  const { error } = await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) back(`/projects/${id}`, explain(error));
  revalidatePath("/", "layout");
  back("/projects", "Moved the project to trash. The admin can restore it.", "ok");
}

export async function joinProject(form: FormData) {
  const { supabase, uid: me } = await uid();
  const id = str(form, "project_id");
  const { error } = await supabase.from("memberships").insert({ person_id: me, project_id: id });
  if (error && error.code !== "23505") back(`/projects/${id}`, explain(error));
  revalidatePath(`/projects/${id}`);
  revalidatePath(`/people/${me}`);
}

export async function leaveProject(form: FormData) {
  const { supabase, uid: me } = await uid();
  const id = str(form, "project_id");
  await supabase.from("memberships").delete().eq("person_id", me).eq("project_id", id);
  revalidatePath(`/projects/${id}`);
  revalidatePath(`/people/${me}`);
}

/** Admins and team leads add someone to a team. The database checks who may. */
export async function addMember(form: FormData) {
  const { supabase } = await uid();
  const project_id = str(form, "project_id");
  const person_id = str(form, "person_id");
  if (!person_id) back(`/projects/${project_id}`, "Pick someone to add");
  const { error } = await supabase.from("memberships").insert({ person_id, project_id });
  if (error && error.code !== "23505") back(`/projects/${project_id}`, explain(error));
  revalidatePath("/", "layout");
}

export async function removeMember(form: FormData) {
  const { supabase } = await uid();
  const project_id = str(form, "project_id");
  const { data, error } = await supabase.from("memberships").delete().eq("project_id", project_id).eq("person_id", str(form, "person_id")).select("person_id");
  if (error || !data?.length) back(`/projects/${project_id}`, error ? explain(error) : "You don't have permission to do that");
  revalidatePath("/", "layout");
}

export async function setLead(form: FormData) {
  const { supabase } = await uid();
  const project_id = str(form, "project_id");
  const lead = str(form, "lead") === "true";
  const { data, error } = await supabase.from("memberships").update({ lead }).eq("project_id", project_id).eq("person_id", str(form, "person_id")).select("person_id");
  if (error || !data?.length) back(`/projects/${project_id}`, error ? explain(error) : "You don't have permission to do that");
  revalidatePath("/", "layout");
}

export async function createFolder(form: FormData) {
  const { supabase, uid: me } = await uid();
  const project_id = str(form, "project_id");
  const name = str(form, "name", 80);
  if (!name) back(`/projects/${project_id}`, "Give the folder a name");
  const { error } = await supabase.from("folders").insert({ project_id, parent_id: optional(form, "parent_id"), name, created_by: me });
  if (error) back(`/projects/${project_id}`, explain(error));
  revalidatePath(`/projects/${project_id}`);
}

export async function renameFolder(form: FormData) {
  const { supabase } = await uid();
  const id = str(form, "id");
  const project_id = str(form, "project_id");
  const name = str(form, "name", 80);
  const parent = optional(form, "parent_id");
  const patch: Record<string, unknown> = {};
  if (name) patch.name = name;
  if (form.has("parent_id")) patch.parent_id = parent === id ? null : parent;
  const { error } = await supabase.from("folders").update(patch).eq("id", id);
  if (error) back(`/projects/${project_id}`, explain(error));
  revalidatePath(`/projects/${project_id}`);
}

export async function trashFolder(form: FormData) {
  const { supabase } = await uid();
  const id = str(form, "id");
  const project_id = str(form, "project_id");
  const { error } = await supabase.from("folders").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) back(`/projects/${project_id}`, explain(error));
  revalidatePath(`/projects/${project_id}`);
  back(`/projects/${project_id}`, "Moved the folder to trash. Its components stay in the project.", "ok");
}

export async function restoreItem(form: FormData) {
  const { supabase } = await uid();
  const table = str(form, "table");
  if (!["projects", "folders", "components", "files"].includes(table)) back("/admin", "Unknown item");
  const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", str(form, "id"));
  if (error) back("/admin", explain(error));
  revalidatePath("/", "layout");
  back("/admin", "Restored", "ok");
}
