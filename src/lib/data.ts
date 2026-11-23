import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { componentHealth, personHealth, type HealthResult } from "@/lib/status";
import type { Comment, Component, Folder, Membership, Mission, Person, Project, Update } from "@/lib/types";

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
function withHealth(components: Component[], latestRows: Update[]): ComponentWithHealth[] {
  const latest = new Map(latestRows.map((u) => [u.component_id, u]));
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

/**
 * Every live component, with health. Small team, so one query is fine.
 * The latest-update query runs at the same time as the components query, not after it:
 * each round trip to the database costs 25 to 60 ms, and pages used to wait for both in a row.
 */
export const getComponents = cache(async (): Promise<ComponentWithHealth[]> => {
  const supabase = await createClient();
  const [{ data }, { data: latest }] = await Promise.all([
    supabase.from("components").select("*").is("deleted_at", null).order("name"),
    supabase.from("latest_updates").select("*"),
  ]);
  return withHealth((data ?? []) as Component[], (latest ?? []) as Update[]);
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

/** Everything a page needs to name and place components. Cached for one request, so pages and metadata share it. */
export const getLibrary = cache(async () => {
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
});

export function canEdit(me: Person, c: Pick<Component, "owner_id">, editorIds: string[] = []): boolean {
  return me.role === "admin" || c.owner_id === me.id || editorIds.includes(me.id);
}

export type Library = Awaited<ReturnType<typeof getLibrary>>;

/**
 * The helpers below take the library or the promise of it. Each starts its own query first and only then waits
 * for the library, so a page can run every query in one round trip instead of two in a row:
 *   const lib = getLibrary(); const [l, updates] = await Promise.all([lib, recentUpdates(lib)]);
 */
type LibraryArg = Library | Promise<Library>;

/** Recent updates on live components, newest first. */
export async function recentUpdates(libArg: LibraryArg, opts: { limit?: number; authorId?: string; week?: string } = {}): Promise<Update[]> {
  const supabase = await createClient();
  let q = supabase.from("updates").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 30);
  if (opts.authorId) q = q.eq("author_id", opts.authorId);
  if (opts.week) q = q.eq("week_start", opts.week);
  const [{ data }, lib] = await Promise.all([q, libArg]);
  const live = new Set(lib.components.map((c) => c.id));
  return ((data ?? []) as Update[]).filter((u) => live.has(u.component_id));
}

/** Each person's freshness from their latest update, plus what they own. */
export async function peopleHealth(libArg: LibraryArg) {
  const supabase = await createClient();
  const [{ data }, lib] = await Promise.all([supabase.from("latest_update_by_author").select("author_id, created_at"), libArg]);
  const latest = new Map((data ?? []).map((u) => [u.author_id as string, u.created_at as string]));
  return lib.people.map((p) => {
    const owned = lib.components.filter((c) => c.owner_id === p.id);
    const active = owned.filter((c) => c.status !== "released" && c.status !== "built");
    return { person: p, owned, active, latest: latest.get(p.id) ?? null, health: personHealth(latest.get(p.id) ?? null, active.length, p.created_at) };
  });
}

export async function getMemberships(): Promise<Membership[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("memberships").select("person_id, project_id, lead");
  return (data ?? []) as Membership[];
}

/** Admins, and leads of this team, can add and remove people and choose leads. */
export function canManageTeam(me: Person, projectId: string, memberships: Membership[]): boolean {
  return me.role === "admin" || memberships.some((m) => m.project_id === projectId && m.person_id === me.id && m.lead);
}

/** Open issues on live parts, newest first. */
export async function openIssues(libArg: LibraryArg): Promise<Comment[]> {
  const supabase = await createClient();
  const [{ data }, lib] = await Promise.all([
    supabase.from("comments").select("*").eq("is_issue", true).is("resolved_at", null).order("created_at", { ascending: false }),
    libArg,
  ]);
  const live = new Set(lib.components.map((c) => c.id));
  return ((data ?? []) as Comment[]).filter((c) => live.has(c.component_id));
}

/** Comments that mention me, newest first. */
export async function myMentions(libArg: LibraryArg, limit = 10): Promise<Comment[]> {
  const supabase = await createClient();
  // Needs only my id, which getMe already has (and caches), not the whole library.
  const me = await getMe();
  const [{ data }, lib] = await Promise.all([supabase.from("comment_mentions").select("comments(*)").eq("person_id", me.id), libArg]);
  const live = new Set(lib.components.map((c) => c.id));
  return ((data ?? []).map((r) => r.comments as unknown as Comment).filter((c) => c && live.has(c.component_id)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

export async function getMission(): Promise<Mission> {
  const supabase = await createClient();
  const { data } = await supabase.from("mission").select("mass_limit_g, power_limit_w").maybeSingle();
  return (data ?? { mass_limit_g: null, power_limit_w: null }) as Mission;
}
