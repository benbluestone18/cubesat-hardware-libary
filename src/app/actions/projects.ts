"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back, explain, optional, safePath, str } from "./util";

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
  // The database adds the creator to the team as its lead and owner.
  revalidatePath("/", "layout");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(form: FormData) {
  const { supabase } = await uid();
  const id = str(form, "id");
  const status = str(form, "status");
  const { data: saved, error } = await supabase.from("projects").update({
    name: str(form, "name", 80),
    description: str(form, "description", 2000),
    status: ["active", "paused", "done"].includes(status) ? status : "active",
  }).eq("id", id).select("id");
  if (error || !saved?.length) back(`/projects/${id}`, error ? explain(error) : "Only this team's leads and admins can change its settings");
  revalidatePath("/", "layout");
  back(`/projects/${id}`, "Project saved", "ok");
}

export async function trashProject(form: FormData) {
  const { supabase } = await uid();
  const id = str(form, "id");
  const { data, error } = await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error || !data?.length) back(`/projects/${id}`, error ? explain(error) : "Only this team's leads and admins can trash it");
  revalidatePath("/", "layout");
  back("/projects", "Moved the project to trash. An admin can restore it.", "ok");
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
  // The database refuses if you own the team and others are still on it.
  const { error } = await supabase.from("memberships").delete().eq("person_id", me).eq("project_id", id);
  if (error) back(`/projects/${id}`, explain(error));
  revalidatePath("/", "layout");
  back(`/projects/${id}`, "You left the team", "ok");
}

/** The owner, or an admin, hands the team to someone already on it. */
export async function transferTeam(form: FormData) {
  const { supabase } = await uid();
  const project_id = str(form, "project_id");
  const { error } = await supabase.rpc("transfer_team", { pid: project_id, new_owner: str(form, "person_id") });
  if (error) back(`/projects/${project_id}`, explain(error));
  revalidatePath("/", "layout");
  back(`/projects/${project_id}`, "Ownership handed over", "ok");
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
  const to = safePath(str(form, "back"), "/admin");
  const { data, error } = await supabase.from(table).update({ deleted_at: null }).eq("id", str(form, "id")).select("id");
  if (error || !data?.length) back(to, error ? explain(error) : "You don't have permission to do that");
  revalidatePath("/", "layout");
  back(to, "Restored", "ok");
}
