"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_ORDER } from "@/lib/status";
import { findMentions } from "@/lib/mentions";
import { back, explain, optional, str } from "./util";

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, me: data?.claims?.sub as string };
}

function onshape(url: string | null): string | null | false {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "onshape.com" || u.hostname.endsWith(".onshape.com")) ? u.toString() : false;
  } catch {
    return false;
  }
}

/** An optional number field: null when blank, false when it isn't a usable number. */
function amount(form: FormData, key: string, max: number): number | null | false {
  const raw = str(form, key, 40).replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : false;
}

function budget(form: FormData, retry: string) {
  const mass_g = amount(form, "mass_g", 100000);
  const power_w = amount(form, "power_w", 1000);
  if (mass_g === false) back(retry, "Mass must be a number of grams between 0 and 100000");
  if (power_w === false) back(retry, "Power must be a number of watts between 0 and 1000");
  return { mass_g, power_w };
}

function status(v: string) {
  return (STATUS_ORDER as string[]).includes(v) ? v : "planned";
}

export async function createComponent(form: FormData) {
  const { supabase, me } = await ctx();
  const project_id = str(form, "project_id");
  const name = str(form, "name", 120);
  const link = onshape(optional(form, "onshape_url", 1000));
  const retry = `/components/new?project=${project_id}`;
  if (!project_id) back(retry, "Pick a project");
  if (!name) back(retry, "Give the part a name");
  if (link === false) back(retry, "The Onshape link must start with https:// and be on onshape.com");
  const sizes = budget(form, retry);
  const { data, error } = await supabase.from("components").insert({
    ...sizes,
    project_id, folder_id: optional(form, "folder_id"), name, owner_id: me,
    description: str(form, "description", 4000), status: status(str(form, "status")),
    onshape_url: link, revision: str(form, "revision", 12) || "A",
  }).select("id").single();
  if (error || !data) back(retry, explain(error));
  revalidatePath("/", "layout");
  redirect(`/components/${data.id}`);
}

export async function updateComponent(form: FormData) {
  const { supabase } = await ctx();
  const id = str(form, "id");
  const link = onshape(optional(form, "onshape_url", 1000));
  if (link === false) back(`/components/${id}/edit`, "The Onshape link must start with https:// and be on onshape.com");
  const sizes = budget(form, `/components/${id}/edit`);
  const { error } = await supabase.from("components").update({
    ...sizes,
    name: str(form, "name", 120), description: str(form, "description", 4000), status: status(str(form, "status")),
    onshape_url: link, revision: str(form, "revision", 12) || "A", folder_id: optional(form, "folder_id"),
  }).eq("id", id).select("id").single();
  if (error) back(`/components/${id}/edit`, explain(error));
  revalidatePath("/", "layout");
  back(`/components/${id}`, "Saved", "ok");
}

export async function setStatus(form: FormData) {
  const { supabase } = await ctx();
  const id = str(form, "id");
  const { error } = await supabase.from("components").update({ status: status(str(form, "status")) }).eq("id", id).select("id").single();
  if (error) back(`/components/${id}`, explain(error));
  revalidatePath("/", "layout");
}

export async function trashComponent(form: FormData) {
  const { supabase } = await ctx();
  const id = str(form, "id");
  const { data, error } = await supabase.from("components").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("project_id").single();
  if (error || !data) back(`/components/${id}`, explain(error));
  revalidatePath("/", "layout");
  back(`/projects/${data.project_id}`, "Moved the component to trash. The team's leads and admins can restore it.", "ok");
}

export async function addEditor(form: FormData) {
  const { supabase, me } = await ctx();
  const id = str(form, "component_id");
  const person = str(form, "person_id");
  if (!person) back(`/components/${id}`, "Pick someone");
  const { error } = await supabase.from("component_editors").insert({ component_id: id, person_id: person, granted_by: me });
  if (error && error.code !== "23505") back(`/components/${id}`, explain(error));
  revalidatePath(`/components/${id}`);
}

export async function removeEditor(form: FormData) {
  const { supabase } = await ctx();
  const id = str(form, "component_id");
  const { error } = await supabase.from("component_editors").delete().eq("component_id", id).eq("person_id", str(form, "person_id"));
  if (error) back(`/components/${id}`, explain(error));
  revalidatePath(`/components/${id}`);
}

export async function handOff(form: FormData) {
  const { supabase } = await ctx();
  const id = str(form, "component_id");
  const to = str(form, "person_id");
  if (!to) back(`/components/${id}`, "Pick the new owner");
  const { error } = await supabase.from("components").update({ owner_id: to }).eq("id", id).select("id").single();
  if (error) back(`/components/${id}`, explain(error));
  revalidatePath("/", "layout");
  back(`/components/${id}`, "Handed off", "ok");
}

export async function addComment(form: FormData) {
  const { supabase, me } = await ctx();
  const id = str(form, "component_id");
  const body = str(form, "body", 4000);
  const is_issue = str(form, "is_issue") === "on";
  if (!body) back(`/components/${id}#comments`, is_issue ? "Describe the issue first" : "Write a comment first");
  const { data, error } = await supabase.from("comments").insert({ component_id: id, author_id: me, body, is_issue }).select("id").single();
  if (error || !data) back(`/components/${id}`, explain(error));
  const { data: people } = await supabase.from("people").select("id, name");
  const mentioned = findMentions(body, people ?? []).filter((p) => p !== me);
  if (mentioned.length) await supabase.from("comment_mentions").insert(mentioned.map((person_id) => ({ comment_id: data.id, person_id })));
  revalidatePath("/", "layout");
}

/** Resolve or reopen an issue. The database decides who may, and records who did. */
export async function setIssue(form: FormData) {
  const { supabase } = await ctx();
  const component_id = str(form, "component_id");
  const resolve = str(form, "resolve") === "true";
  const { data, error } = await supabase.from("comments").update({ resolved_at: resolve ? new Date().toISOString() : null })
    .eq("id", str(form, "id")).eq("is_issue", true).select("id");
  if (error || !data?.length) back(`/components/${component_id}#comments`, error ? explain(error) : "Only the person who raised it, the part's editors or an admin can change this issue");
  revalidatePath("/", "layout");
}

export async function deleteComment(form: FormData) {
  const { supabase } = await ctx();
  const id = str(form, "component_id");
  await supabase.from("comments").delete().eq("id", str(form, "id"));
  revalidatePath(`/components/${id}`);
}

export async function similarNames(q: string): Promise<{ id: string; name: string; project_name: string }[]> {
  const { supabase } = await ctx();
  if (q.trim().length < 3) return [];
  const { data } = await supabase.rpc("similar_components", { q: q.slice(0, 120) });
  return data ?? [];
}
