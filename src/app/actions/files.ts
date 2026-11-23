"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { back, explain, str } from "./util";

const MAX = 50 * 1024 * 1024;

/** Records a file the browser already uploaded to storage. The database re-checks edit rights. */
export async function recordFile(input: { component_id: string; revision: string; storage_path: string; filename: string; size_bytes: number; content_type: string }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;
  if (!input.storage_path.startsWith(input.component_id + "/")) return { error: "That upload doesn't belong to this part" };
  if (input.size_bytes > MAX) return { error: "Files can be up to 50 MB" };
  const { error } = await supabase.from("files").insert({ ...input, revision: input.revision.slice(0, 12) || "A", uploaded_by: me });
  if (error) {
    await supabase.storage.from("component-files").remove([input.storage_path]);
    return { error: explain(error) };
  }
  revalidatePath(`/components/${input.component_id}`);
  return { error: null };
}

export async function trashFile(form: FormData) {
  const supabase = await createClient();
  const component_id = str(form, "component_id");
  const { error } = await supabase.from("files").update({ deleted_at: new Date().toISOString() }).eq("id", str(form, "id")).select("id").single();
  if (error) back(`/components/${component_id}`, explain(error), "error", "files");
  revalidatePath(`/components/${component_id}`);
  back(`/components/${component_id}`, "Moved the file to trash. The team's leads and admins can restore it.", "ok", "files");
}

/** A readable name for a link when the person doesn't give one. */
function linkLabel(url: URL): string {
  const h = url.hostname.replace(/^www\./, "");
  if (h === "drive.google.com") return url.pathname.includes("/folders/") ? "Google Drive folder" : "Google Drive file";
  if (h === "docs.google.com") {
    const kind = url.pathname.split("/")[1];
    return { document: "Google Doc", spreadsheets: "Google Sheet", presentation: "Google Slides", forms: "Google Form" }[kind] ?? "Google Docs";
  }
  return h;
}

export async function addLink(form: FormData) {
  const supabase = await createClient();
  const component_id = str(form, "component_id");
  let url: URL;
  try { url = new URL(str(form, "url", 2000)); } catch { back(`/components/${component_id}`, "That doesn't look like a link. Copy it from the browser's address bar or Drive's Share button.", "error", "links"); }
  if (url.protocol !== "https:") back(`/components/${component_id}`, "Links must start with https://", "error", "links");
  const label = str(form, "label", 120) || linkLabel(url);
  const { data: claims } = await supabase.auth.getClaims();
  const { error } = await supabase.from("component_links").insert({ component_id, url: url.toString(), label, added_by: claims?.claims?.sub });
  if (error) back(`/components/${component_id}`, explain(error), "error", "links");
  revalidatePath(`/components/${component_id}`);
}

export async function removeLink(form: FormData) {
  const supabase = await createClient();
  const component_id = str(form, "component_id");
  const { data, error } = await supabase.from("component_links").delete().eq("id", str(form, "id")).select("id");
  if (error || !data?.length) back(`/components/${component_id}`, error ? explain(error) : "You don't have permission to do that", "error", "links");
  revalidatePath(`/components/${component_id}`);
}
