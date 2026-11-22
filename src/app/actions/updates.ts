"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { weekStart } from "@/lib/week";
import { back, explain, str } from "./util";

/** Posts this week's 3-line update. Posting again in the same week replaces it. */
export async function postUpdate(form: FormData) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;
  const component_id = str(form, "component_id");
  const done = str(form, "done", 1000);
  const next = str(form, "next", 1000);
  const blocked = str(form, "blocked", 1000);
  const retry = `/updates/new?component=${component_id}`;
  if (!component_id) back(retry, "Pick a component");
  if (!done && !next && !blocked) back(retry, "Fill in at least one line");
  const week_start = weekStart();
  const { error } = await supabase.from("updates").upsert(
    { component_id, author_id: me, week_start, done, next, blocked, edited_at: new Date().toISOString() },
    { onConflict: "component_id,week_start" },
  );
  if (error) back(retry, explain(error));
  revalidatePath("/", "layout");
  redirect(`/components/${component_id}?ok=${encodeURIComponent("Update posted")}`);
}
