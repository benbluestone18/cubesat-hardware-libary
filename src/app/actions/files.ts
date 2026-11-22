"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { back, explain, str } from "./util";

const MAX = 20 * 1024 * 1024;

/** Records a file the browser already uploaded to storage. The database re-checks edit rights. */
export async function recordFile(input: { component_id: string; revision: string; storage_path: string; filename: string; size_bytes: number; content_type: string }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;
  if (!input.storage_path.startsWith(input.component_id + "/")) return { error: "That upload doesn't belong to this component" };
  if (input.size_bytes > MAX) return { error: "Files can be up to 20 MB" };
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
  if (error) back(`/components/${component_id}`, explain(error));
  revalidatePath(`/components/${component_id}`);
}
