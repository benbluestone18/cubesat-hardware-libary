import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { componentHealth, personHealth, type HealthResult } from "@/lib/status";
import type { Component, Folder, Person, Project, Update } from "@/lib/types";

/** The signed-in person, or a redirect to sign-in. Cached for one request. */
export const getMe = cache(async (): Promise<Person> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/login");
  const { data } = await supabase.from("people").select("*").eq("id", uid).single();
  if (!data) redirect("/login?error=domain");
  return data as Person;
});

export const getPeople = cache(async (): Promise<Person[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("people").select("*").order("name");
  return (data ?? []) as Person[];
});

export const getProjects = cache(async (): Promise<Project[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").is("deleted_at", null).order("name");
  return (data ?? []) as Project[];
});

export type ComponentWithHealth = Component & { health: HealthResult; latest: Update | null };

/** Components with their latest update and freshness. */
export async function withHealth(components: Component[]): Promise<ComponentWithHealth[]> {
  if (components.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("latest_updates").select("*").in("component_id", components.map((c) => c.id));
  const latest = new Map(((data ?? []) as Update[]).map((u) => [u.component_id, u]));
  return components.map((c) => {
    const l = latest.get(c.id) ?? null;
    return { ...c, latest: l, health: componentHealth({ ...c, latest_blocked: l?.blocked }) };
  });
}


export const getFolders = cache(async (): Promise<Folder[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("folders").select("*").is("deleted_at", null).order("name");
  return (data ?? []) as Folder[];
});

/** Every live component, with health. Small team, so one query is fine. */
export const getComponents = cache(async (): Promise<ComponentWithHealth[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("components").select("*").is("deleted_at", null).order("name");
  return withHealth((data ?? []) as Component[]);
});

/** "ADCS / Reaction wheels / Mounts": the project, then each folder down to this one. */
export function pathOf(projectId: string, folderId: string | null, projects: Map<string, Project>, folders: Map<string, Folder>): string {
  const parts: string[] = [];
  let f = folderId ? folders.get(folderId) : undefined;
  let guard = 0;
  while (f && guard++ < 40) { parts.unshift(f.name); f = f.parent_id ? folders.get(f.parent_id) : undefined; }
  parts.unshift(projects.get(projectId)?.name ?? "Unknown project");
  return parts.join(" / ");
}

export function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

/** Everything a page needs to name and place components. */
export async function getLibrary() {
  const [me, people, projects, folders, components] = await Promise.all([getMe(), getPeople(), getProjects(), getFolders(), getComponents()]);
  const P = byId(projects);
  const F = byId(folders);
  // Components in a trashed project are hidden everywhere.
  const live = components.filter((c) => P.has(c.project_id));
  return {
    me, people, projects, folders, components: live,
    person: byId(people), project: P, folder: F,
    path: (c: Pick<Component, "project_id" | "folder_id">) => pathOf(c.project_id, c.folder_id, P, F),
    /** The folder part alone: "Sensors / Sun sensors". */
    folderPath: (projectId: string, folderId: string) => pathOf(projectId, folderId, P, F).split(" / ").slice(1).join(" / "),
  };
}

export function canEdit(me: Person, c: Pick<Component, "owner_id">, editorIds: string[] = []): boolean {
  return me.role === "admin" || c.owner_id === me.id || editorIds.includes(me.id);
}

export type Library = Awaited<ReturnType<typeof getLibrary>>;

/** Recent updates on live components, newest first. */
export async function recentUpdates(lib: Library, opts: { limit?: number; authorId?: string; week?: string } = {}): Promise<Update[]> {
  const supabase = await createClient();
  let q = supabase.from("updates").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 30);
  if (opts.authorId) q = q.eq("author_id", opts.authorId);
  if (opts.week) q = q.eq("week_start", opts.week);
  const { data } = await q;
  const live = new Set(lib.components.map((c) => c.id));
  return ((data ?? []) as Update[]).filter((u) => live.has(u.component_id));
}

/** Each person's freshness from their latest update, plus what they own. */
export async function peopleHealth(lib: Library) {
  const supabase = await createClient();
  const { data } = await supabase.from("latest_update_by_author").select("author_id, created_at");
  const latest = new Map((data ?? []).map((u) => [u.author_id as string, u.created_at as string]));
  return lib.people.map((p) => {
    const owned = lib.components.filter((c) => c.owner_id === p.id);
    const active = owned.filter((c) => c.status !== "released" && c.status !== "built");
    return { person: p, owned, active, latest: latest.get(p.id) ?? null, health: personHealth(latest.get(p.id) ?? null, active.length, p.created_at) };
  });
}

export async function getMemberships(): Promise<{ person_id: string; project_id: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("memberships").select("person_id, project_id");
  return data ?? [];
}
