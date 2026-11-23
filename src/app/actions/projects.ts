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
  const mass = str(form, "mass_budget_g", 40), power = str(form, "power_budget_w", 40);
  const mass_budget_g = mass ? Number(mass) : null, power_budget_w = power ? Number(power) : null;
  if (mass_budget_g !== null && !(mass_budget_g > 0 && mass_budget_g <= 100000)) back(`/projects/${id}`, "The mass budget must be grams, above 0");
  if (power_budget_w !== null && !(power_budget_w > 0 && power_budget_w <= 1000)) back(`/projects/${id}`, "The power budget must be watts, above 0");
  const { data: saved, error } = await supabase.from("projects").update({
    mass_budget_g, power_budget_w,
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
  if (error && error.code !== "23505") back(`/projects/${id}`, explain(error), "error", "team");
  revalidatePath(`/projects/${id}`);
  revalidatePath(`/people/${me}`);
}

export async function leaveProject(form: FormData) {
  const { supabase, uid: me } = await uid();
  const id = str(form, "project_id");
  // The database refuses if you own the team and others are still on it.
  const { error } = await supabase.from("memberships").delete().eq("person_id", me).eq("project_id", id);
  if (error) back(`/projects/${id}`, explain(error), "error", "team");
  revalidatePath("/", "layout");
  back(`/projects/${id}`, "You left the team", "ok", "team");
}

/** The owner, or an admin, hands the team to someone already on it. */
export async function transferTeam(form: FormData) {
  const { supabase } = await uid();
  const project_id = str(form, "project_id");
  const { error } = await supabase.rpc("transfer_team", { pid: project_id, new_owner: str(form, "person_id") });
  if (error) back(`/projects/${project_id}`, explain(error), "error", "team");
  revalidatePath("/", "layout");
  back(`/projects/${project_id}`, "Ownership handed over", "ok", "team");
}

/** Admins and team leads add someone to a team. The database checks who may. */
export async function addMember(form: FormData) {
  const { supabase } = await uid();
  const project_id = str(form, "project_id");
  const person_id = str(form, "person_id");
  if (!person_id) back(`/projects/${project_id}`, "Pick someone to add", "error", "team");
  const { error } = await supabase.from("memberships").insert({ person_id, project_id });
  if (error && error.code !== "23505") back(`/projects/${project_id}`, explain(error), "error", "team");
  const { data: who } = await supabase.from("people").select("name").eq("id", person_id).maybeSingle();
  revalidatePath("/", "layout");
  back(`/projects/${project_id}`, `Added ${who?.name ?? "them"} to the team`, "ok", "team");
}

export async function removeMember(form: FormData) {
  const { supabase } = await uid();
  const project_id = str(form, "project_id");
  const { data, error } = await supabase.from("memberships").delete().eq("project_id", project_id).eq("person_id", str(form, "person_id")).select("person_id");
  if (error || !data?.length) back(`/projects/${project_id}`, error ? explain(error) : "You don't have permission to do that", "error", "team");
  revalidatePath("/", "layout");
  back(`/projects/${project_id}`, "Removed from the team", "ok", "team");
}

export async function setLead(form: FormData) {
  const { supabase } = await uid();
  const project_id = str(form, "project_id");
  const lead = str(form, "lead") === "true";
  const { data, error } = await supabase.from("memberships").update({ lead }).eq("project_id", project_id).eq("person_id", str(form, "person_id")).select("person_id");
  if (error || !data?.length) back(`/projects/${project_id}`, error ? explain(error) : "You don't have permission to do that", "error", "team");
  revalidatePath("/", "layout");
  back(`/projects/${project_id}`, lead ? "Made team lead" : "No longer a team lead", "ok", "team");
}

export async function createFolder(form: FormData) {
  const { supabase, uid: me } = await uid();
  const project_id = str(form, "project_id");
  const name = str(form, "name", 80);
  if (!name) back(`/projects/${project_id}`, "Give the folder a name", "error", "library");
  const { error } = await supabase.from("folders").insert({ project_id, parent_id: optional(form, "parent_id"), name, created_by: me });
  if (error) back(`/projects/${project_id}`, explain(error), "error", "library");
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
  if (error) back(`/projects/${project_id}`, explain(error), "error", "library");
  revalidatePath(`/projects/${project_id}`);
}

export async function trashFolder(form: FormData) {
  const { supabase } = await uid();
  const id = str(form, "id");
  const project_id = str(form, "project_id");
  const { error } = await supabase.from("folders").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) back(`/projects/${project_id}`, explain(error), "error", "library");
  revalidatePath(`/projects/${project_id}`);
  back(`/projects/${project_id}`, "Moved the folder to trash. Its parts and subfolders now sit at the top of the Library, and go back in if the folder is restored.", "ok", "library");
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

/** Admins set the whole satellite's mass and power limits. */
export async function setMissionLimits(form: FormData) {
  const { supabase } = await uid();
  const mass = str(form, "mass_limit_g", 40), power = str(form, "power_limit_w", 40);
  const mass_limit_g = mass ? Number(mass) : null, power_limit_w = power ? Number(power) : null;
  if (mass_limit_g !== null && !(mass_limit_g > 0 && mass_limit_g <= 100000)) back("/projects", "The mass limit must be grams, above 0");
  if (power_limit_w !== null && !(power_limit_w > 0 && power_limit_w <= 1000)) back("/projects", "The power limit must be watts, above 0");
  const { data, error } = await supabase.from("mission").update({ mass_limit_g, power_limit_w, updated_at: new Date().toISOString() }).eq("id", true).select("id");
  if (error || !data?.length) back("/projects", error ? explain(error) : "Only an admin can change the satellite limits");
  revalidatePath("/", "layout");
  back("/projects#budget", "Satellite limits saved", "ok");
}
